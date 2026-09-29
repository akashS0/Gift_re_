-- Stock price database for Supabase (Postgres).
-- Sized for the free tier (500 MB): closes are stored as integer paise, and adjusted prices are
-- derived from a small adjustment_periods table instead of a second price column on every row.
-- Safe to re-run: every statement is idempotent.

create table if not exists securities (
    id          smallint generated always as identity primary key,
    symbol      text not null unique,   -- current NSE symbol (RELIANCE); indices keep their Bloomberg code (NSEMCAP)
    isin        text unique,            -- current ISIN; older ISINs (pre-split, pre-merger) live in security_aliases
    name        text,
    bbg_code    text,                   -- Bloomberg code without ' IN Equity', e.g. HDFCB
    industry    text,
    sec_type    text not null default 'equity'
                check (sec_type in ('equity', 'etf', 'invit', 'reit', 'index')),
    created_at  timestamptz not null default now()
);

-- Every label a security has appeared under in a source file: 'SWE', 'HDFCB', an old ISIN, a pre-rename NSE symbol.
create table if not exists security_aliases (
    alias        text     not null,     -- upper-case
    kind         text     not null check (kind in ('bbg', 'isin', 'nse')),
    security_id  smallint not null references securities (id) on delete cascade,
    primary key (alias, kind)
);

create table if not exists price_sources (
    id     smallint primary key,
    name   text not null unique,        -- source file name, or 'nse_yfinance' for the Algo Trading parquet files
    basis  text not null                -- how that source's prices are adjusted for splits/bonuses
);

-- Column order (4, 4, 2, 2 bytes) avoids alignment padding; ~64 bytes per row including the primary key.
create table if not exists daily_prices (
    trade_date   date     not null,
    close_paise  integer  not null check (close_paise > 0),   -- close x 100, as the source reported it
    security_id  smallint not null references securities (id) on delete cascade,
    source_id    smallint not null references price_sources (id),
    primary key (security_id, trade_date)
);

-- close x factor = close on today's split/bonus basis. Each source file has its own basis, so
-- periods are per security and source; a price with no matching period has factor 1.
create table if not exists adjustment_periods (
    security_id  smallint not null references securities (id) on delete cascade,
    source_id    smallint not null references price_sources (id),
    valid_from   date     not null,
    valid_to     date     not null,     -- inclusive
    factor       double precision not null check (factor > 0),
    primary key (security_id, source_id, valid_from)
);

create or replace view prices with (security_invoker = true) as
select s.symbol,
       p.trade_date,
       p.close_paise / 100.0                                              as close,
       round(p.close_paise / 100.0 * coalesce(a.factor, 1)::numeric, 4)  as adj_close,
       ps.name                                                            as source
from daily_prices p
join securities s     on s.id = p.security_id
join price_sources ps on ps.id = p.source_id
left join adjustment_periods a
       on a.security_id = p.security_id
      and a.source_id = p.source_id
      and p.trade_date between a.valid_from and a.valid_to;

-- Supabase exposes the public schema over its REST API: allow reads, and only the loader
-- (which connects as the postgres role and bypasses RLS) can write.
do $$
declare t text;
begin
    foreach t in array array['securities', 'security_aliases', 'price_sources', 'daily_prices', 'adjustment_periods'] loop
        execute format('alter table %I enable row level security', t);
        if not exists (select 1 from pg_policies where tablename = t and policyname = 'public read') then
            execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
        end if;
    end loop;
end $$;
