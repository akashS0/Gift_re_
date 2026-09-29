"""Paths shared by the database build and load scripts."""
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
ROOT = DB_DIR.parent

EXCEL_DIR = ROOT.parent / "Data" / "Stock Prices"                                    # Bloomberg exports (primary source)
PARQUET_DIR = Path(r"C:\Users\Singh\Desktop\Algo Trading\data\raw\prices")       # NSE daily prices, fill the gaps
UNIVERSE_CSV = Path(r"C:\Users\Singh\Desktop\Algo Trading\data\universe.csv")    # NSE symbol <-> ISIN
COMPANY_META_CSV = Path(r"C:\Users\Singh\Desktop\Algo Trading\data\company_meta.csv")

REFERENCE_DIR = DB_DIR / "mapping" / "reference"   # Investment Team Bloomberg code / ISIN / NSE mapping files
OVERRIDES_CSV = DB_DIR / "mapping" / "overrides.csv"  # manual fixes, applied after the automatic mapping
OUTPUT_DIR = DB_DIR / "output"                     # build.py writes here, load_supabase.py reads from here
ENV_FILE = ROOT / ".env"
