import { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, ComposedChart, Cell, ScatterChart, Scatter, ZAxis, LabelList
} from "recharts";

/* ------------------------------------------------------------------
   GIFT RE — Research Portal
   Doctor of Business Administration in Emerging Technologies
   Golden Gate University · Cohort 6894 · Abhay Tewari
   Structured after the May 2026 research-proposal presentation:
   01 Context & Opportunity · 02 Research & Industry Insights ·
   03 Solution Propositions & Evidence (with Models A and B) ·
   04 Competition, Financials & Roadmap · 05 Team, Capital & SWOT ·
   06 Business Impact & Key Takeaways · plus Paper, Interviews,
   Insights and Documents.
------------------------------------------------------------------- */

const INK = "#12253F";        // deck navy
const GOLD = "#C4A35A";       // deck gold
const PANEL = "#EEF1F5";      // deck light-grey panel
const LINE = "#D5DAE1";
const TEAL = "#2E8A87";       // MVP 2.0 / opportunities
const GREEN = "#3B7A5A";      // strengths
const RED = "#B04A5A";        // weaknesses
const MARINE = TEAL;          // Model A accent
const RUST = RED;             // Model B accent
const PAPER = "#FFFFFF";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const NAV = [
  { id: "p1", num: "01", label: "Context & Opportunity" },
  { id: "p2", num: "02", label: "Research & Industry Insights" },
  { id: "p3", num: "03", label: "Solution Propositions & Evidence" },
  { id: "model-a", num: "", label: "Model A · ML float management", sub: true },
  { id: "wm-models",  num: "01", label: "The models", sub2: true },
  { id: "wm-process", num: "02", label: "Process walkthrough", sub2: true },
  { id: "wm-outputs", num: "03", label: "Model outputs", sub2: true },
  { id: "wm-spec",    num: "04", label: "Data & model specs", sub2: true },
  { id: "wm-outputs-check", num: "05", label: "Check outputs", sub2: true },
  { id: "model-b", num: "", label: "Model B · Synthetic CAT pricing", sub: true },
  { id: "p4", num: "04", label: "Competition, Financials & Roadmap" },
  { id: "p5", num: "05", label: "Team, Capital & SWOT" },
  { id: "p6", num: "06", label: "Business Impact & Key Takeaways" },
  { id: "paper", num: "", label: "Research paper", group: "Evidence base" },
  { id: "interviews", num: "", label: "Interviews", group: "Evidence base" },
  { id: "insights", num: "", label: "Interview insights", group: "Evidence base" },
  { id: "documents", num: "", label: "Documents", group: "Evidence base" },
  { id: "about", num: "", label: "About the researcher", group: "Evidence base" },
];

const DOCS = [
  { name: "Final submission — Gift Re business plan (Cohort 6894, 2 Sep 2026)", type: "Word · ~41,000 words · 37 tables · 10 figures", status: "Download", href: "docs/Gift-Re-Business-Plan-Final-Submission.docx" },
  { name: "Research proposal presentation — Gift Re, An AI-Powered Global Reinsurer (May 2026, 38 slides)", type: "PDF", status: "Download", href: "docs/Gift-Re-Research-Proposal-Presentation.pdf" },
  { name: "Insights from Interview Questions — thematic and statistical analysis (21 participants, 25-code codebook)", type: "Word · ~3,500 words · 3 appendices", status: "Download", href: "docs/Insights-from-Interview-Questions.docx" },
  { name: "Interview transcripts and notes (21 senior leaders)", type: "Transcripts / notes", status: "To be uploaded" },
  { name: "Interview question guide (Q1–Q20, IRB-approved)", type: "PDF / Word", status: "To be uploaded" },
  { name: "Working model — ML for float management (four classifiers, pipeline walkthrough, reported outputs)", type: "Interactive page · runs in the browser", status: "Open", href: "working-model/index.html" },
  { name: "Check outputs — the BiLSTM's stock-by-stock output for any quarter from Q4FY21, or a new quarter scored from its base data", type: "Interactive page", status: "Open", href: "check-outputs/index.html" },
  { name: "Sample quarterly extract — 1,000 stocks × 12 quarters × 13 factors (synthetic)", type: "CSV · 1.5 MB", status: "Download", href: "working-model/sample-quarterly-data.csv" },
  { name: "BiLSTM Top-30 model — notebook, 13 factor parameters and backtest output", type: "Jupyter / Python", status: "To be uploaded — will replace Model A simulation" },
  { name: "Synthetic CAT scenario generator (WGAN-GP / VAE) — code and EVT calibration", type: "Python", status: "Next research phase — will replace Model B simulation" },
  { name: "Reference list", type: "APA 7", status: "In the paper" },
];

/* -------------------- Paper content (curated) -------------------- */

const CHAPTERS = [
  {
    id: "exec", title: "Executive summary",
    body: [
      "Gift Re is proposed as an AI-native global reinsurer based in GIFT City, India's International Financial Services Centre. The global reinsurance market is growing at 10–11% a year and the Indian market at roughly 15%, with foreign reinsurers gaining share against the state-backed GIC Re.",
      "Two capabilities differentiate the venture: machine-learning management of the investment float, and generative-AI synthetic data for pricing catastrophe and other rare risks. The investment MVP, trained on 16 years of data for 1,000 companies and backtested over 4 years, outperforms the benchmark indices. Projections support a path to USD 300M+ gross premium within three years on a lean cost base.",
    ],
  },
  {
    id: "company", title: "Company description",
    body: [
      "Vision, mission and value proposition centre on affordable, technology-led reinsurance for underserved markets. Operations run from GIFT City so that cross-border arrangements are possible from day one, while the early focus is Indian cedants where IRDAI licensing gives new entrants immediate credibility.",
      "Strategy is built on a founding team that blends underwriters, actuaries, AI engineers, investment professionals and salespeople, and on alignment with industry shifts toward risk-based capital, parametric covers and digital placement.",
    ],
  },
  {
    id: "litreview", title: "Literature review",
    body: [
      "The review traces the evolution of catastrophe risk modelling, the acute data limitations of emerging economies, and the use of GANs and VAEs to synthesise rare-event distributions. On the asset side it covers BiLSTM, CNN, Random Forest and Temporal Fusion Transformer models for time-series and stock selection, and the Sharpe and Treynor measures used to judge risk-adjusted performance.",
      "Gaps identified: reinsurers apply AI mostly to underwriting and claims, rarely to float and capital management; actuarial and investment functions operate in silos; and traditional CAT models struggle with low-frequency, high-severity, data-scarce perils such as climate and cyber.",
    ],
  },
  {
    id: "hypotheses", title: "Research hypotheses",
    body: [
      "H1 — ML-based investment management of the reinsurance float (BiLSTM, CNN, Random Forest, TFT) will generate superior risk-adjusted returns versus benchmark indices and conventional reinsurer strategies. Expected outcome: better Sharpe and Treynor ratios, more efficient float deployment and higher ROCE while holding solvency and liquidity.",
      "H2 — Synthetic data from GANs and VAEs will improve the accuracy, stability and fairness of pricing for rare or emerging risks compared with traditional actuarial and catastrophe models. Expected outcome: better capture of tail frequency and severity, lower margins for adverse deviation, and a narrower protection gap.",
      "Both hypotheses are tested through semi-structured interviews with 20–25 senior industry professionals and a quantitative backtest of the investment model.",
    ],
  },
  {
    id: "insights", title: "Customer insights",
    body: [
      "Interviews with CEOs, Chief and Appointed Actuaries, Heads of Products and reinsurance broking leaders were coded thematically against the two hypotheses. On the asset side, three themes emerged: limitations of traditional ALM, ML for dynamic asset allocation, and explainability as the price of regulatory acceptance. On the liability side: data scarcity, the sensitivity of CAT models to small assumption errors, and synthetic data as a complement rather than a replacement for real experience.",
      "A recurring observation was that investment and underwriting risks are treated as independent, when systemic events such as a pandemic or a major catastrophe hit both sides of the balance sheet at once.",
    ],
    table: {
      caption: "Table 1 — Strategic shift in capital deployment",
      head: ["Feature", "Before: liquidity buffers", "After: yield optimisation"],
      rows: [
        ["Asset profile", "Large holding in low-yielding cash and money-market instruments to meet unpredictable claims.", "Better asset-liability matching gives sufficient liquidity while allocating more to longer bonds and equities."],
        ["Capital and ROCE", "Low yields plus higher regulatory capital make capital inefficient.", "A balanced portfolio lifts float yield and releases capital under risk-based capital, raising ROCE."],
      ],
    },
  },
  {
    id: "competition", title: "Competitive landscape",
    body: [
      "Munich Re and Swiss Re lead on completeness of offering and analytics; Hannover Re competes on stable, measured pricing; SCOR, Everest and others follow. In India, GIC Re remains dominant but foreign branches grow faster. Brokers dominate distribution globally, though direct relationships matter more in India.",
      "The TAM is the ~USD 700B global reinsurance pool accessible via GIFT City; the SOM is realistic Indian placements outside compulsory cession, with a defined share targeted through digital, parametric and underserved segments.",
    ],
  },
  {
    id: "org", title: "Organisation and key roles",
    body: [
      "A lean structure led by underwriting, actuarial, investment and technology heads, with model-governance and compliance built in from the start. The chapter also sets out the transition from rule-based solvency to India's emerging risk-based capital regime, and why a new entrant can design its systems for it rather than retrofit.",
    ],
  },
  {
    id: "product", title: "Product, services and technology",
    body: [
      "The Gift Re platform combines a risk-pricing engine (data ingestion, cleaning, synthetic scenario generation, EVT calibration) with an investment engine (data collection, pattern analysis, stock ranking, top-30 selection). Architecture covers system, data and security layers with an API-first design.",
      "The MVP roadmap runs from foundational capabilities in Year 1 to enhanced analytics and automation in Year 2 and full-scale AI-driven reinsurance in Year 3, alongside a patent, trademark and trade-secret strategy.",
    ],
  },
  {
    id: "backtest", title: "MVP evidence — investment backtest",
    body: [
      "The BiLSTM Top-30 strategy was trained on 16 years of data and tested out-of-sample on the following 4 years (Q4 FY21–Q3 FY25) with quarterly rebalancing. It returned a 43.7% CAGR against 12.3% for the Nifty 50, with a Sharpe ratio of 1.08 and information ratio of 1.32. The test window spans the 2021 liquidity rally, 2022 tightening, the 2023 mid-cap rally and 2024 election volatility.",
      "Overfitting is addressed through the strict hold-out, comparable train/test performance, dropout regularisation, a small theoretically grounded feature set (Nifty 200 factor indices) and economically interpretable factor rotation. Explore the numbers in Model A.",
    ],
    table: {
      caption: "Table 12 — Back-test results (4-year out-of-sample)",
      head: ["Strategy", "CAGR", "Std dev", "Beta", "Sharpe", "Treynor", "Alpha", "IR"],
      rows: [
        ["Nifty 50", "12.3%", "13.0%", "1.00", "0.46", "0.06", "0.0%", "—"],
        ["Nifty 200 Quality 30", "12.0%", "16.8%", "1.23", "0.37", "0.05", "-1.1%", "0.04"],
        ["Nifty 200 Momentum 30", "15.5%", "23.2%", "1.57", "0.47", "0.07", "1.4%", "0.36"],
        ["Nifty 200 Value 30", "27.1%", "20.9%", "1.24", "0.96", "0.16", "12.7%", "1.04"],
        ["Nifty 200 Alpha 30", "20.9%", "26.3%", "1.83", "0.62", "0.09", "5.3%", "0.67"],
        ["BiLSTM Top 30", "43.7%", "33.8%", "2.30", "1.08", "0.16", "22.7%", "1.32"],
      ],
    },
  },
  {
    id: "marketing", title: "Marketing and sales strategy",
    body: [
      "Cedants are segmented by profile, need and the value lever Gift Re can pull for them. Positioning rests on transparent AI pricing, fast quotes and support for new risks. A PESTEL analysis and a multi-channel plan — thought leadership, broker enablement, conferences, embedded and parametric partnerships — support a go-to-market that starts with broker-led participations and builds a rating roadmap with fronting partners.",
    ],
  },
  {
    id: "financials", title: "Financial plan and funding",
    body: [
      "Pricing is technical-price plus explicit loadings, kept stable to avoid premium churn. The three-year pro-forma shows gross premium of USD 60M, 151M and 301M with a loss ratio near 85%, commission at 10% and expense ratio falling from 6% to 2%. Solvency capital is held at 40% of GWP, above the ~33% Indian norm.",
      "Cumulative funding of roughly USD 130–140M is allocated about 80% to solvency and underwriting capital, 7% to technology and R&D, 6% to people, 4% to go-to-market and 3% to operations and contingency.",
    ],
    table: {
      caption: "Table 31 — Three-year pro-forma P&L (USD million)",
      head: ["Line item", "Year 1", "Year 2", "Year 3"],
      rows: [
        ["Gross premium", "60.25", "150.63", "301.26"],
        ["Commission", "6.03", "15.06", "30.13"],
        ["Claims", "51.11", "127.99", "255.97"],
        ["Investment income", "2.41", "6.03", "12.05"],
        ["Operational expense", "3.62", "4.82", "6.03"],
        ["Underwriting profit", "1.81", "8.66", "21.10"],
        ["Capital", "24.10", "60.25", "120.50"],
      ],
    },
  },
  {
    id: "risk", title: "Risk analysis",
    body: [
      "A risk register covers investment-model risks (look-ahead bias, overfitting, liquidity and transaction costs, behaviour in the 2008 and 2020 crises), synthetic-data risks (plausible-but-false scenarios, no signal for genuinely novel perils), and model and concept drift. Mitigations include strict hold-out testing, human-in-the-loop investment committees, EVT calibration of generated tails, and formal model governance with explainability for regulators.",
    ],
  },
  {
    id: "ipr", title: "IPR strategy",
    body: [
      "Trademarks for the Gift Re brand, trade secrets and copyright for the models and data pipelines, and a simplified provisional patent concept for a generative-AI method that augments scarce catastrophe loss data and adjusts the extreme-loss portion of the distribution. Patent feasibility is assessed by invention and jurisdiction.",
    ],
  },
  {
    id: "conclusion", title: "Conclusion and ethics",
    body: [
      "The plan concludes that a viable, profitable AI-native reinsurer can be built from GIFT City, with premium growing from USD 60M to 301M over three years. The ethics chapter covers interview consent, anonymisation, data handling and the responsible use of AI in pricing decisions.",
    ],
  },
];

const QUESTIONS = [
  { q: "Q2–Q3", h: "Background", title: "Expert backgrounds", finding: "Senior leaders with 20+ years across RBC and IFRS. Most are becoming acquainted with AI and ML, but current adoption remains low." },
  { q: "Q4", h: "Both", title: "Drivers of ROCE", finding: "Views split: pricing and underwriting discipline; risk selection and diversification (more critical for reinsurers than insurers); and float management — reinsurers hold over 2x annual premium as float, so a small yield gain compounds into a large advantage." },
  { q: "Q5", h: "H1", title: "Current investment practice", finding: "Long-term government instruments for safety and liquidity. No in-house equity or alternatives teams. Strategy driven by duration or bucket-wise cash-flow matching. Asset and liability data sit in silos, reviewed quarterly rather than in real time." },
  { q: "Q6", h: "H1", title: "Limitations of traditional ALM", finding: "Nominal fixed-income hedges create real-return mismatches against inflation-linked claims. Duration matching only works for parallel yield-curve shifts. Short-tail lines force everything into T-bills. Investment and underwriting risk are treated as independent, which systemic events disprove." },
  { q: "Q7", h: "H1", title: "ML for asset allocation and stock selection", finding: "ML can adjust allocation dynamically from large unstructured inputs such as sentiment, and move beyond linear quant limits. Random Forests and Gradient Boosting capture nonlinear patterns across regimes." },
  { q: "Q8", h: "H1", title: "Superior risk-adjusted returns", finding: "Agreement that ML can generate alpha; debate over whether allocation or selection matters more. Cautions: low signal-to-noise in financial data, regime breaks, transaction costs from frequent rebalancing. Consensus favours AI assisting a human investment team." },
  { q: "Q9", h: "H1", title: "Capital efficiency and ROCE", finding: "Liquidity for catastrophe claims is the binding constraint. Deep networks reading weather and supply-chain data could predict liquidity needs, letting reinsurers hold cash only when claim events are likely and deploy the rest of the float into higher-yielding assets." },
  { q: "Q10", h: "H1", title: "Regulatory and liquidity constraints", finding: "Algorithmic monoculture risk: similar models on similar data could trigger simultaneous fire sales. Risk-based capital charges on equity volatility may offset yield gains, so models must optimise return per unit of capital, not just return." },
  { q: "Q11", h: "H2", title: "Traditional models and rare risks", finding: "Rare events lack the history traditional pricing needs; estimates become unstable. Independence assumptions fail — a catastrophe hits millions of policies and can crash markets at the same time. Old data may mislead where climate has shifted." },
  { q: "Q12", h: "H2", title: "Where CAT models fall short", finding: "A 1–2% assumption error can move estimated loss by 25–50%, so actuaries add large margins for adverse deviation, pushing premiums and capital up and products out of reach. GANs and VAEs can generate thousands of realistic scenarios instead of waiting decades." },
  { q: "Q13", h: "H2", title: "Role of synthetic data — GANs and VAEs", finding: "Strong supporting tool. WGAN-GP learns the statistical shape of extreme events without rigid assumptions and can combine perils (cyclone plus supply-chain collapse) that have never co-occurred but are plausible. For 1-in-100/200 events, synthetic scenarios fill the data gap." },
  { q: "Q14", h: "H2", title: "Adoption barriers", finding: "GANs only recombine what they have seen; a novel peril (AI-driven cyberattack) can yield realistic-looking but meaningless output. Actuaries are sceptical; regulators are unlikely to allow lower reserves justified solely on synthetic data." },
  { q: "Q15–Q17", h: "H2", title: "Accuracy and operational issues", finding: "ML improves pricing accuracy but needs rebuilt infrastructure: automated pipelines, parallel processing, containerised deployment. Explainability is essential. Actuaries trace every assumption; data scientists iterate on correlations — a cultural gap HR must manage." },
  { q: "Q18–Q19", h: "Both", title: "The AI-native reinsurer advantage", finding: "Building from scratch enables real-time ALM with daily portfolio adjustment from liability data, joint projection of assets and liabilities, and better modelling of the correlation between market risk and claims risk under RBC — releasing capital." },
  { q: "Q20", h: "H2", title: "Closing the protection gap", finding: "Many Indians are uninsured for lack of documents. ML underwriting on alternative data (utility bills, satellite imagery) and real-time climate or IoT wellness data can both extend cover and prevent claims." },
];

const THEMES = {
  H1: [
    { t: "Traditional ALM is defensive, not optimal", d: "Duration matching, nominal bonds and quarterly silos protect liquidity but sacrifice yield and mis-hedge inflation-linked claims.", stance: "supports" },
    { t: "ML enables dynamic, nonlinear allocation", d: "Tree ensembles and recurrent networks capture regime shifts and unstructured signals that linear models miss.", stance: "supports" },
    { t: "Alpha must be measured per unit of capital", d: "RBC charges on equity volatility and transaction costs can erode headline outperformance.", stance: "cautions" },
    { t: "Human-in-the-loop is the accepted operating model", d: "Experts want ML to inform an investment committee, not replace it — also the route to explainability.", stance: "cautions" },
    { t: "Monoculture and liquidity risk", d: "If everyone runs similar models, stress events could trigger correlated selling.", stance: "cautions" },
  ],
  H2: [
    { t: "Data scarcity makes rare-risk pricing unstable", d: "Too few events; independence assumptions fail; old data misleads under climate change.", stance: "supports" },
    { t: "CAT model sensitivity drives over-pricing", d: "Small assumption errors swing PML by 25–50%, so margins for adverse deviation make cover unaffordable.", stance: "supports" },
    { t: "Synthetic data complements real experience", d: "WGAN-GP and VAEs, seeded with regional claims, hazard data and analogue geographies and calibrated with EVT, fill the tail.", stance: "supports" },
    { t: "No signal for genuinely novel perils", d: "Generative models recombine learned patterns; a never-seen risk type can produce plausible noise.", stance: "cautions" },
    { t: "Regulators will not accept synthetic-only justification", d: "Explainability, audit trails and human sign-off are preconditions for capital relief.", stance: "cautions" },
  ],
};

/* -------------------- Backtest data (Table 14) -------------------- */

const QUARTERS = ["Q4 FY21","Q1 FY22","Q2 FY22","Q3 FY22","Q4 FY22","Q1 FY23","Q2 FY23","Q3 FY23","Q4 FY23","Q1 FY24","Q2 FY24","Q3 FY24","Q4 FY24","Q1 FY25","Q2 FY25","Q3 FY25"];
const RET = {
  "BiLSTM Top 30": [21.97,11.94,4.56,6.85,22.40,-4.19,-14.02,17.85,18.99,12.01,32.58,5.79,41.09,-8.13,-21.77,24.13],
  "Nifty 50":      [9.94,-0.87,-1.11,-1.25,7.08,5.63,-7.75,7.11,3.88,4.57,9.19,2.49,12.01,-4.38,-8.31,11.87],
  "Quality 30":    [11.81,-0.87,-3.01,-1.76,7.23,0.82,-5.95,8.98,4.21,7.88,8.63,4.19,17.25,-6.77,-14.60,13.07],
  "Momentum 30":   [13.41,2.69,-3.05,-7.06,7.99,4.43,-11.71,14.36,8.56,12.83,19.67,13.91,8.61,-7.69,-22.11,14.35],
  "Value 30":      [3.97,2.46,2.38,0.05,8.45,7.74,-2.78,10.99,11.98,19.83,26.30,12.61,10.24,-8.74,-15.09,16.16],
};
const SERIES_COLORS = { "BiLSTM Top 30": GOLD, "Nifty 50": INK, "Quality 30": "#8A97A8", "Momentum 30": TEAL, "Value 30": GREEN };

const PNL = {
  1: { gwp: 60.25, claims: 51.11, uw: 1.81, capital: 24.10, invPaper: 2.41 },
  2: { gwp: 150.63, claims: 127.99, uw: 8.66, capital: 60.25, invPaper: 6.03 },
  3: { gwp: 301.26, claims: 255.97, uw: 21.10, capital: 120.50, invPaper: 12.05 },
};

/* -------------------- Interview study (from "Insights from Interview Questions") -------------------- */

const SAMPLE = [
  { type: "Insurers", n: 13 }, { type: "Reinsurers", n: 4 }, { type: "Independent consultants", n: 3 }, { type: "Former regulator (ex-IRDAI Member, Actuary)", n: 1 },
];

const ROSTER = [
  ["Pradeep", "Chief Actuary", "Insurer", 25], ["Pawan", "Appointed Actuary", "Insurer", 18], ["Gopal Joshi", "Head of Products", "Insurer", 20],
  ["Suresh Sindhi", "Appointed Actuary", "Reinsurer", 25], ["Sombit", "Investor Relations Head", "Insurer", 15], ["Saddam", "Chief Risk Officer", "Insurer", 18],
  ["Mohit", "Chief Strategy Officer", "Insurer", 25], ["Sai Srinivas", "Consulting Actuary", "Consultant", 30], ["Ranabir", "EVP, Actuarial", "Insurer", 17],
  ["Gopal Kumar", "Practicing Actuary", "Consultant", 22], ["Suri", "Senior VP, Sales Strategy", "Insurer", 25], ["Sreekumar", "Senior Operations Leader", "Insurer", 40],
  ["Sanjeev Srinivasan", "Senior Insurance Executive", "Insurer", 30], ["Sanjeeb", "Chairman, Gallagher India (reinsurance broking)", "Reinsurer", 36],
  ["Sandeep Kumar", "Senior Strategy Executive", "Insurer", 25], ["Pramod", "Former Member (Actuary), IRDAI", "Regulator", 40], ["Asfa", "Appointed Actuary", "Insurer", 20],
  ["Mahaveer", "Deputy Chief Underwriter, Munich Re", "Reinsurer", 25], ["Arindam", "Chief Distribution Officer", "Insurer", 25],
  ["Vinayak", "Reinsurance Intermediary Lead", "Reinsurer", 22], ["Saket Singhal", "Proprietor, Actuarial Consultancy", "Consultant", 23],
];

const ROCE_DRIVERS = [
  { driver: "Pricing accuracy", mean: 2.80, median: 2.0, sd: 2.31, top3: 15, tier: 1 },
  { driver: "Underwriting discipline", mean: 3.20, median: 3.0, sd: 1.91, top3: 13, tier: 1 },
  { driver: "Risk selection & diversification", mean: 4.17, median: 3.0, sd: 2.29, top3: 12, tier: 2 },
  { driver: "Investment returns / float", mean: 4.45, median: 4.0, sd: 1.57, top3: 3, tier: 2 },
  { driver: "Technology maturity (AI / automation)", mean: 5.42, median: 5.0, sd: 2.28, top3: 3, tier: 2 },
  { driver: "Operating efficiency / cost", mean: 5.58, median: 6.0, sd: 2.03, top3: 3, tier: 2 },
  { driver: "Digital onboarding / STP", mean: 6.58, median: 7.8, sd: 2.65, top3: 4, tier: 3 },
  { driver: "Innovative product design", mean: 6.78, median: 7.0, sd: 2.76, top3: 4, tier: 3 },
  { driver: "Marketing & brand visibility", mean: 7.88, median: 9.0, sd: 2.69, top3: 1, tier: 3 },
  { driver: "CRM & retention", mean: 7.97, median: 9.0, sd: 2.39, top3: 2, tier: 3 },
];
const TIER_COLOR = { 1: INK, 2: MARINE, 3: "#9AAAB8" };

const RANK_COLS = ["PA", "UD", "RS", "IR", "TM", "OE", "DO", "PD", "MB", "CRM"];
const RANK_MATRIX = [
  ["Pradeep","Insurer",1,2,10,4,5,7,6,3,8,9],["Pawan","Insurer",6,4,3,5,1,7,2,7,9,8],["G. Joshi","Insurer",3,5,7,1,6,2,8,9,4,10],
  ["S. Sindhi","Reinsurer",6,4,3,8,2,7,1,5,9,10],["Sombit","Insurer",1,2,3,5,4,6,8,7,10,9],["Saddam","Insurer",1,3,2,4,5,6,7,9,10,8],
  ["Mohit","Insurer",2,3,5,4,6,8,9,1,7,10],["Sai S.","Consultant","3*","3*","3*","3*","3*","3*","8*","10*","3*","8*"],["Ranabir","Insurer",6,1,5,7,2,9,4,10,8,3],
  ["G. Kumar","Consultant",1,6,5,2,4,3,9,7,8,10],["Suri","Insurer",3,1,2,4,5,6,7,9,10,8],["Sreekumar","Insurer",1,2,3,4,7,6,8,9,10,5],
  ["Sanjeev","Insurer",2,1,3,4,5,6,8,7,10,9],["Sanjeeb","Reinsurer",9,7,4,6,10,6,3,1,6,2],["Sandeep K.","Insurer",1,2,3,4,6,5,8,7,10,9],
  ["Pramod","Regulator",4,6,8,5,7,1,9,3,2,10],["Asfa","Insurer",3,1,2,4,8,6,9,7,10,5],["Mahaveer","Reinsurer",1,6,3,4,5,7,2,9,10,8],
  ["Arindam","Insurer",1,2,3,6,5,7,9,8,4,10],["Vinayak","Reinsurer",1,3,2,5,6,4,7,8,10,9],
];

const CODEBOOK = [
  ["T01","Duration matching / ALM core",19],["T02","IRDAI / regulatory constraints",18],["T03","Capital efficiency / ROCE uplift",18],
  ["T04","Data quality / availability gap",21],["T05","Alternative & unstructured data",12],["T06","Real-time / dynamic ALM",12],
  ["T07","Hybrid ML + traditional approach",18],["T08","Low-frequency / high-severity risk",20],["T09","Climate-cat risk mentioned",18],
  ["T10","Cyber risk mentioned",16],["T11","Synthetic data: promising",19],["T12","Synthetic data: caution / concerns",20],
  ["T13","Explainability / interpretability",21],["T14","Regulatory acceptance hurdle",21],["T15","Bias / overfitting risk",17],
  ["T16","Validation / back-testing difficulty",18],["T17","Talent scarcity",21],["T18","Actuarial / cultural resistance",18],
  ["T19","Hybrid path > pure AI-native",19],["T20","Regulator role decisive",21],["T21","Human-in-the-loop required",21],
  ["T22","Real-time pricing potential",15],["T23","Emerging risks (cyber, climate)",21],["T24","Capex / implementation cost",14],
  ["T25","Governance / MRM framework",21],
];

const CONDITIONS = [
  "Data quality and availability", "Explainability and interpretability", "Regulatory acceptance", "Specialist talent",
  "The regulator's decisive role", "Humans in the loop", "Emerging risks — cyber and climate", "A model-risk-management framework",
];


/* -------------------- Shared UI (deck styling) -------------------- */

function Eyebrow({ children }) {
  return (
    <div className="mb-2">
      <span className="text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{children}</span>
      <div className="mt-1" style={{ width: 48, height: 4, background: GOLD }} />
    </div>
  );
}
function PageHeader({ eyebrow, title, sub }) {
  return (
    <div className="mb-8">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-4xl font-bold leading-tight mt-3" style={{ fontFamily: SERIF, color: INK }}>{title}</h1>
      {sub && <p className="mt-3 text-base text-gray-600 max-w-3xl leading-7">{sub}</p>}
    </div>
  );
}
function H2({ children, color = INK, eyebrow }) {
  return (
    <div className="mt-12 mb-4">
      {eyebrow && <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{eyebrow}</div>}
      <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color }}>{children}</h2>
    </div>
  );
}
function H1({ children, sub }) { return <PageHeader title={children} sub={sub} />; }
function P({ children }) { return <p className="text-gray-800 leading-7 mb-4 max-w-3xl">{children}</p>; }

/* White card with gold top bar — the deck's standard content card */
function Card({ title, children, icon, bar = true, className = "" }) {
  return (
    <div className={"bg-white border " + className} style={{ borderColor: LINE, borderTop: bar ? `5px solid ${GOLD}` : `1px solid ${LINE}` }}>
      <div className="p-5">
        {title && <div className="text-lg font-bold mb-2" style={{ fontFamily: SERIF, color: INK }}>{icon && <span className="mr-2" style={{ color: GOLD }}>{icon}</span>}{title}</div>}
        <div className="text-sm text-gray-700 leading-6">{children}</div>
      </div>
    </div>
  );
}
/* Navy card with gold label */
function DarkCard({ label, title, children }) {
  return (
    <div className="text-white" style={{ background: INK }}>
      <div className="p-5">
        {label && <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{label}</div>}
        {title && <div className="text-xl font-bold mb-3" style={{ fontFamily: SERIF }}>{title}</div>}
        <div className="text-sm leading-6" style={{ color: "#DCE3EC" }}>{children}</div>
      </div>
    </div>
  );
}
/* Panel with gold left rule — deck's callout */
function Callout({ children, title }) {
  return (
    <div className="p-5 my-6 max-w-3xl" style={{ background: PANEL, borderLeft: `6px solid ${GOLD}` }}>
      {title && <div className="text-xl font-bold mb-1" style={{ fontFamily: SERIF, color: INK }}>{title}</div>}
      <div className="text-sm text-gray-700 leading-6">{children}</div>
    </div>
  );
}
function Bullet({ children, color = GOLD }) {
  return <li className="flex gap-3 mb-2"><span className="mt-2 flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} /><span>{children}</span></li>;
}
function Table({ caption, head, rows, highlightLast }) {
  return (
    <div className="my-6 max-w-4xl">
      {caption && <p className="text-sm text-gray-600 italic mb-2">{caption}</p>}
      <div className="overflow-x-auto border bg-white" style={{ borderColor: LINE }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: INK, color: "white" }}>
              {head.map((h, i) => <th key={i} className={"px-3 py-2 font-medium " + (i === 0 ? "text-left" : "text-right")}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={"border-t " + (highlightLast && i === rows.length - 1 ? "font-bold" : "")}
                  style={{ borderColor: LINE, background: highlightLast && i === rows.length - 1 ? "#F6EFDD" : i % 2 ? PANEL : "white" }}>
                {r.map((c, j) => <td key={j} className={"px-3 py-2 align-top " + (j === 0 ? "text-left" : "text-right")}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Slider({ label, value, min, max, step = 1, onChange, fmt = (v) => v, color = INK }) {
  return (
    <label className="block mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold" style={{ color }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </label>
  );
}
function Stat({ label, value, note, color = INK }) {
  return (
    <div className="pl-3 py-1" style={{ borderLeft: `4px solid ${GOLD}` }}>
      <div className="text-3xl font-bold" style={{ fontFamily: SERIF, color }}>{value}</div>
      <div className="text-sm text-gray-700 mt-1">{label}</div>
      {note && <div className="text-xs text-gray-500 mt-1">{note}</div>}
    </div>
  );
}
function BigStat({ value, label, sub, dark }) {
  return (
    <div className="p-5 text-center" style={dark ? { background: INK, color: "white" } : { background: PANEL }}>
      <div className="text-4xl font-bold" style={{ fontFamily: SERIF, color: dark ? GOLD : INK }}>{value}</div>
      <div className="text-sm mt-1 font-semibold">{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: dark ? "#C9D2DE" : "#666" }}>{sub}</div>}
    </div>
  );
}
function Note({ children, color = GOLD }) {
  return <div className="my-6 max-w-4xl text-sm text-gray-700 p-4" style={{ background: PANEL, borderLeft: `6px solid ${color}` }}>{children}</div>;
}
function Chip({ children, color }) {
  return <span className="inline-block text-xs px-2 py-0.5 border mr-2" style={{ color, borderColor: color }}>{children}</span>;
}
function NumBadge({ n }) {
  return <div className="text-3xl font-bold mb-1" style={{ fontFamily: SERIF, color: GOLD }}>{n}<div style={{ width: 40, height: 3, background: GOLD }} /></div>;
}
function Circle({ n }) {
  return <div className="flex-shrink-0 rounded-full flex items-center justify-center text-xl font-bold" style={{ width: 52, height: 52, background: INK, color: GOLD, fontFamily: SERIF }}>{n}</div>;
}

/* -------------------- 01 · Context & Opportunity -------------------- */

function RiskQuadrant() {
  // Frequency (x) vs severity (y) — the deck's risk-appetite diagram
  return (
    <svg viewBox="0 0 520 300" className="w-full" style={{ maxWidth: 560 }}>
      <rect x="60" y="20" width="220" height="130" fill={INK} />
      <rect x="280" y="20" width="220" height="130" fill={PANEL} />
      <rect x="60" y="150" width="220" height="130" fill={PANEL} />
      <rect x="280" y="150" width="220" height="130" fill="#F6EFDD" />
      <text x="72" y="44" fill={GOLD} fontSize="11" fontFamily={SERIF} letterSpacing="2">LOW FREQ · HIGH SEVERITY</text>
      <text x="72" y="62" fill="white" fontSize="13" fontWeight="bold" fontFamily={SERIF}>Reinsurer — Gift Re plays here</text>
      {["Catastrophe risk", "Pandemics", "Industrial explosion", "Cyber-attacks"].map((t, i) => (
        <text key={t} x="72" y={84 + i * 16} fill="#DCE3EC" fontSize="11">• {t}</text>
      ))}
      <text x="292" y="174" fill={GOLD} fontSize="11" fontFamily={SERIF} letterSpacing="2">HIGH FREQ · LOW SEVERITY</text>
      <text x="292" y="192" fill={INK} fontSize="13" fontWeight="bold" fontFamily={SERIF}>Insurer</text>
      {["Auto insurance", "Health", "Life (base layer)"].map((t, i) => (
        <text key={t} x="292" y={214 + i * 16} fill="#444" fontSize="11">• {t}</text>
      ))}
      <line x1="60" y1="280" x2="500" y2="280" stroke={INK} strokeWidth="1.5" />
      <line x1="60" y1="280" x2="60" y2="20" stroke={INK} strokeWidth="1.5" />
      <text x="280" y="296" textAnchor="middle" fill={INK} fontSize="11">Frequency of claims →</text>
      <text x="28" y="150" textAnchor="middle" fill={INK} fontSize="11" transform="rotate(-90 28 150)">Severity ↑</text>
    </svg>
  );
}

function Part1({ go }) {
  const chain = [
    ["Insurer", "Primary carrier", "Issues policies to individuals and businesses. Retains manageable risk, cedes excess to a reinsurer."],
    ["Reinsurer", "Secondary risk taker", "Assumes a portion of risk from insurers. Spreads it across geographies and lines. May cede further."],
    ["Retrocessionaire", "Reinsurer's reinsurer", "Provides cover to reinsurers. Caps their exposure to extreme, correlated loss events."],
  ];
  const products = [
    ["Life & Health", "Mortality, morbidity, longevity, critical illness. Target: LIC, private life insurers, general insurers and stand-alone health insurers (SAHI)."],
    ["Property & Casualty", "Fire, earthquake, flood, cyclone. Parametric triggers built in for tier-3/4 rural portfolios."],
    ["Treaty", "Proportional and non-proportional for portfolio-level risk transfer. Multi-year renewals for stable relationships."],
    ["Facultative", "Case-by-case cover for specific large or unusual risks falling outside treaty terms."],
    ["Parametric", "Trigger-based payouts — wind speed, rainfall, magnitude. Instant settlement for catastrophe response."],
    ["Crop & Cyber", "AI-risk liability, data breach, ransomware. Priced via synthetic scenarios where historical data is absent."],
  ];
  const whyNow = [
    ["Climate losses rising", "Insured nat-cat losses reached USD 137B in 2024 and are projected to cross USD 145B in 2025. Frequency and severity are both accelerating."],
    ["Improved generative AI", "GANs, VAEs and Temporal Fusion Transformers can now generate reliable synthetic tail scenarios and explain their outputs to actuaries and regulators."],
    ["India is fast but underinsured", "Indian insurance revenues have grown >10% CAGR for 20+ years even as rates fell by more than 10%. Tier-3/4 markets remain underserved; foreign reinsurers stay away."],
    ["Regulatory tailwinds at GIFT City", "100% FDI, GST removed, IFSCA framework for cross-border reinsurance. India is moving from rule-based to Risk-Based Capital — rewarding better modelling. A Public Insurance Registry is envisaged for underserved segments."],
  ];
  const regions = [
    { name: "North America", pct: 44, excl: true }, { name: "Europe", pct: 29 }, { name: "Asia Pacific", pct: 20 },
    { name: "Latin America", pct: 5, excl: true }, { name: "Middle East & Africa", pct: 2 },
  ];
  return (
    <div>
      {/* Hero */}
      <div className="text-white p-8 md:p-10 mb-10" style={{ background: INK }}>
        <div className="text-xs mb-4" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Doctor of Business Administration · Research Proposal</div>
        <h1 className="text-5xl md:text-6xl font-bold leading-none mb-3" style={{ fontFamily: SERIF }}>GIFT RE</h1>
        <div className="text-2xl mb-4" style={{ fontFamily: SERIF, color: GOLD }}>An AI-Powered Global Reinsurer</div>
        <p className="max-w-2xl leading-7" style={{ color: "#DCE3EC" }}>Synthetic data for risk pricing. ML for reinsurance asset management. Built at GIFT City. Catering to the needs of emerging economies.</p>
        <div className="mt-6 pt-5 text-sm grid md:grid-cols-3 gap-4" style={{ borderTop: `1px solid ${GOLD}55`, color: "#DCE3EC" }}>
          <div><span style={{ color: GOLD }}>Presented by</span><br /><button className="underline" onClick={() => go("about")}>Abhay Tewari</button></div>
          <div><span style={{ color: GOLD }}>Programme</span><br />DBA in Emerging Technologies · Golden Gate University · Cohort 6894</div>
          <div><span style={{ color: GOLD }}>Chair</span><br />Dr. Siwar Jendoubi · May 2026</div>
        </div>
      </div>

      {/* Reinsurance 101 */}
      <H2 eyebrow="01 · Context">What is reinsurance — the risk-transfer chain</H2>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {chain.map(([a, b, c], i) => (
          <div key={a} className="bg-white border p-5" style={{ borderColor: LINE }}>
            <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{a}</div>
            <div className="font-bold text-lg mb-2" style={{ fontFamily: SERIF, color: INK }}>{b}</div>
            <div className="text-sm text-gray-700">{c}</div>
          </div>
        ))}
      </div>
      <div className="md:flex gap-8 items-start mb-4">
        <div className="md:w-1/2"><div className="text-xs mb-2" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Risk appetite · who takes what</div><RiskQuadrant /></div>
        <div className="md:w-1/2 text-sm text-gray-700 leading-6 pt-6">Insurers keep the high-frequency, low-severity book — auto, health, base-layer life. Reinsurers take the low-frequency, high-severity tail — catastrophe, pandemic, industrial and cyber. Gift Re is designed for that top-left quadrant, where data is thinnest and pricing matters most.</div>
      </div>

      {/* Two problems */}
      <H2 eyebrow="01 · Context">Two unresolved problems on a reinsurer's balance sheet</H2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border" style={{ borderColor: LINE }}>
          <div className="p-4 text-white" style={{ background: INK }}><div className="text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>The liability side</div><div className="text-xl font-bold" style={{ fontFamily: SERIF }}>Pricing what you can't model</div></div>
          <ul className="p-5 text-sm text-gray-700">
            <Bullet color={RED}>Catastrophe risks are rare, severe and thinly documented — especially in emerging markets</Bullet>
            <Bullet color={RED}>CAT models calibrated on US/Atlantic data fail on Indian flood, cyclone and monsoon risks</Bullet>
            <Bullet color={RED}>Actuaries add large adverse-deviation margins, so premiums become unaffordable</Bullet>
            <Bullet color={RED}>The protection gap in tier-3/4 India keeps widening</Bullet>
          </ul>
        </div>
        <div className="bg-white border" style={{ borderColor: LINE }}>
          <div className="p-4 text-white" style={{ background: INK }}><div className="text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>The asset side</div><div className="text-xl font-bold" style={{ fontFamily: SERIF }}>Generating investment alpha</div></div>
          <ul className="p-5 text-sm text-gray-700">
            <Bullet>Reinsurance float is ~2x capital — large, persistent, investable capital</Bullet>
            <Bullet>Most reinsurers invest conservatively: short-tenor government bonds, zero equities. Berkshire is the exception</Bullet>
            <Bullet>ALM runs in silos — quarterly, rule-based, not integrated with the claims distribution</Bullet>
            <Bullet>Hedge funds have been using ML for alpha; reinsurers have not</Bullet>
          </ul>
        </div>
      </div>

      {/* Vision / Mission / USP */}
      <H2 eyebrow="01 · Vision · Mission · USP">Vision, Mission & USP</H2>
      <Callout title="Gift Re — An AI-Powered Global Reinsurer at GIFT City, India">
        <span className="font-semibold" style={{ color: INK }}>Synthetic data for risk pricing · ML for reinsurance float · Integrated ALM · Built for emerging markets</span>
      </Callout>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="bg-white border p-5 mb-4" style={{ borderColor: LINE, borderLeft: `6px solid ${GOLD}` }}>
            <div className="text-lg font-bold mb-1" style={{ fontFamily: SERIF, color: GOLD }}>Vision</div>
            <div className="text-sm text-gray-700 leading-6">To lead the reinsurance market in developing countries, transforming risk and investment management through technology — handling complex catastrophic risks while maximising returns on capital.</div>
          </div>
          <div className="bg-white border p-5" style={{ borderColor: LINE, borderLeft: `6px solid ${INK}` }}>
            <div className="text-lg font-bold mb-1" style={{ fontFamily: SERIF, color: INK }}>Mission</div>
            <div className="text-sm text-gray-700 leading-6">To enable insurers with technology-driven reinsurance solutions, enhancing risk resilience and financial security — aligned with India's "Insurance for All by 2047" and the needs of underinsured emerging economies.</div>
          </div>
        </div>
        <DarkCard title="Unique selling propositions">
          {["Synthetic data alongside historical claims to price catastrophe risks where data is scarce",
            "ML-driven investment management to generate superior risk-adjusted returns on reinsurance float",
            "Fully integrated ALM platform where claims distribution, liquidity needs and solvency capital feed into asset duration and mix across money market, debt and equity",
            "Proprietary models purpose-built for tier-3/4 India and other underinsured emerging economies"].map((t, i) => (
              <div key={i} className="flex gap-3 mb-3"><span className="font-bold" style={{ color: GOLD }}>{i + 1}</span><span>{t}</span></div>
            ))}
        </DarkCard>
      </div>

      {/* Products */}
      <H2 eyebrow="01 · Products">Product portfolio — covering the full reinsurance lifecycle</H2>
      <div className="grid md:grid-cols-3 gap-4">
        {products.map(([t, d]) => <Card key={t} title={t} bar={false}>{d}</Card>)}
      </div>

      {/* Why now */}
      <H2 eyebrow="01 · Opportunity">Why now — increasing requirements, emerging solutions</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {whyNow.map(([t, d]) => (
          <div key={t} className="bg-white border p-5" style={{ borderColor: LINE, borderLeft: `6px solid ${GOLD}` }}>
            <div className="text-lg font-bold mb-1" style={{ fontFamily: SERIF, color: INK }}>{t}</div>
            <div className="text-sm text-gray-700 leading-6">{d}</div>
          </div>
        ))}
      </div>

      {/* Protection gap */}
      <H2 eyebrow="01 · Opportunity">The protection gap — 18% of people, less than 2% of reinsurance</H2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <BigStat value="$700B → $2,000B" label="Global reinsurance" sub="2024 → 2034" />
        <BigStat value="$10B → $40B" label="India reinsurance" sub="2024 → 2034" />
        <BigStat value="~18%" label="India's share of global population" dark />
        <BigStat value="1.4% → 2%" label="India's share of global reinsurance" sub="2024 → 2034" dark />
      </div>
      <div className="text-xs text-gray-500 mb-2">Sources: Precedence Research (2025); UN World Population Prospects (2024)</div>

      {/* TAM SAM SOM */}
      <H2 eyebrow="01 · Market">TAM · SAM · SOM — a credible path to USD 4B+ by year 10</H2>
      <div className="md:flex gap-6">
        <div className="md:w-1/2">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <BigStat value="$700B" label="TAM" sub="global reinsurance 2024" dark />
            <BigStat value="~$363B" label="SAM" sub="excl. North & Latin America" />
            <BigStat value="$1.5B+" label="SOM · Year 5" sub="$4B+ by Year 10" />
          </div>
          <div className="text-sm text-gray-700 leading-6 mb-3"><span className="font-semibold">Year 5 · ~USD 1.5B:</span> $1.0B Asia-Pacific + $0.5B other regions, as digital, parametric and embedded placements scale.</div>
          <div className="text-sm text-gray-700 leading-6"><span className="font-semibold">Year 10 · USD 4B+:</span> $2.0B Asia-Pacific + $2.0B other regions, assuming the Indian market continues at ~15% CAGR and GIFT City gains global standing.</div>
        </div>
        <div className="md:w-1/2 bg-white border p-3" style={{ borderColor: LINE }}>
          <div className="text-sm text-gray-600 mb-2">Global reinsurance market by region, 2024 (North America + Latin America = 49%, excluded from SAM)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regions} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 50]} unit="%" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v + "%"} />
              <Bar dataKey="pct" name="Share">{regions.map((r, i) => <Cell key={i} fill={r.excl ? "#B9C2CD" : GOLD} />)}<LabelList dataKey="pct" position="right" formatter={(v) => v + "%"} style={{ fontSize: 11, fill: INK }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-500">Source: Precedence Research (2025). Grey bars are excluded from SAM.</div>
        </div>
      </div>

      {/* Core proposition */}
      <H2 eyebrow="01 · Core proposition">AI to make reinsurance more effective</H2>
      <P>Specifically: whether ML-driven investment management can generate superior risk-adjusted returns, and whether generative models (GANs/VAEs) can meaningfully improve catastrophe risk pricing in data-scarce markets.</P>
      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={() => go("model-a")} className="text-left text-white p-6" style={{ background: INK }}>
          <div className="text-4xl font-bold" style={{ fontFamily: SERIF, color: GOLD }}>SP1</div>
          <div className="text-xl font-bold mt-1" style={{ fontFamily: SERIF }}>ML for float management</div>
          <div className="text-sm mt-1" style={{ color: "#DCE3EC" }}>Asset side · return generation</div>
          <div className="text-xs mt-4" style={{ color: GOLD }}>Open Model A</div>
        </button>
        <button onClick={() => go("model-b")} className="text-left text-white p-6" style={{ background: INK }}>
          <div className="text-4xl font-bold" style={{ fontFamily: SERIF, color: GOLD }}>SP2</div>
          <div className="text-xl font-bold mt-1" style={{ fontFamily: SERIF }}>Synthetic data for risk pricing</div>
          <div className="text-sm mt-1" style={{ color: "#DCE3EC" }}>Liability side · better pricing</div>
          <div className="text-xs mt-4" style={{ color: GOLD }}>Open Model B</div>
        </button>
      </div>
    </div>
  );
}

/* -------------------- 02 · Research & Industry Insights -------------------- */

function Part2({ go }) {
  const liab = [
    ["Hurricane Andrew (1992) revealed that pricing each peril in isolation with conservative margins fails when multiple hazards interact simultaneously — giving rise to the structured Hazard · Vulnerability · Exposure · Financial Loss framework.", "BIS (2025); Golnaraghi et al. (2018)"],
    ["Traditional GLMs capture individual risk factors but cannot model non-linear interactions or joint tail behaviour across correlated perils — leaving multi-peril portfolios priced inaccurately.", "Burnecki et al. (2024)"],
    ["Wasserstein GANs (WGAN-GP) preserve heavy-tailed distributions, enabling reliable synthesis of joint extreme-loss scenarios for reinsurance pricing.", "Gu et al. (2025)"],
    ["In emerging markets, thin claims history limits traditional calibration. Satellite imagery, geospatial demographics and real-time environmental data can augment scarce records to build credible CAT models for tier-3/4 India.", "Guin et al. (2024)"],
  ];
  const asset = [
    ["Among hedge funds, ML usage is high; in (re)insurance it is absent or negligible.", "Peterson et al. (2025)"],
    ["Most reinsurers are focused on liquidity and invest in short-duration bonds, with no equity exposure.", "Al Harrison et al. (2025)"],
    ["Berkshire earns alpha from fundamentals; no ML applied to float.", "Buffett et al. (2024)"],
    ["ML forecasts can double the performance of traditional investment strategies, with higher Sharpe ratios. BiLSTM networks excel at capturing forward and backward temporal dependencies in volatile markets.", "Gu et al. (2020); Zhang et al. (2024)"],
  ];
  const six = [
    ["Investment management is an under-exploited lever", "Multiple CEOs and Appointed Actuaries said better returns on float — even a few basis points — compound into a meaningful competitive edge over time."],
    ["Traditional ALM is broken in two ways", "Nominal-bond portfolios create real-return mismatches on inflation-sensitive claims, and short-tail duration matching forces reinsurers into sub-optimal low-yield T-bills."],
    ["ML can beat linear models — but explainability is a hard constraint", "Actuaries will reject any model they cannot explain to IRDAI. Random Forests and TFTs are accepted more readily than deep neural nets."],
    ["Catastrophe models break under emerging-market conditions", "A 2% error in vulnerability assumptions can swing PML by 50%. CAT models calibrated on US data consistently misprice Indian flood and cyclone risk."],
    ["Synthetic data is promising — but a complement, not a substitute", "GANs work on known-pattern rare events. For truly novel risks (e.g., AI-driven cyberattack) they can produce realistic-looking but meaningless output."],
    ["An AI-enabled reinsurer will have a structural advantage", "Building infrastructure from scratch enables real-time ALM, daily ML-driven rebalancing and alternative-data underwriting for undocumented populations."],
  ];
  const gaps = [
    ["Synthetic-data pricing is not operationalised", "Reinsurers use AI/ML to facilitate underwriting, but synthetic data creation has not been applied. Integration of Extreme Value Theory and GLMs with these technologies is not well covered in the literature."],
    ["ML for float management is a hedge-fund, not a reinsurer", "Deep and reinforcement learning are used extensively by hedge funds; in reinsurance the approach of optimising returns while balancing liability duration, solvency capital and liquidity remains unexplored."],
    ["Emerging-market catastrophe modelling is incomplete and not transferable", "Existing CAT models are calibrated on US/Atlantic hazard, vulnerability and exposure data. The assumptions do not transfer to Indian flood, cyclone or monsoon conditions."],
    ["Explainability gap", "Every pricing assumption must be certifiable by an Appointed Actuary. Deep learning outputs lack auditable causal chains. No incumbent has operationalised a hybrid ML → GLM pipeline that satisfies both accuracy and regulatory explainability."],
  ];
  return (
    <div>
      <PageHeader eyebrow="Part two" title="Research & Industry Insights" sub="Evidence from industry and academic research, customer and practitioner insights — converging on actionable opportunities for Gift Re." />

      <H2 eyebrow="02 · Research & industry insights">What the evidence says — two streams, one opportunity</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {[["Liabilities stream · generating synthetic data to improve risk pricing", liab], ["Assets stream · better float management", asset]].map(([t, items]) => (
          <div key={t} className="bg-white border" style={{ borderColor: LINE }}>
            <div className="p-4 text-white text-lg font-bold" style={{ background: INK, fontFamily: SERIF }}>{t}</div>
            <ul className="p-5 text-sm text-gray-700">
              {items.map(([a, b]) => <Bullet key={b}>{a} <span className="italic" style={{ color: GOLD }}>{b}</span></Bullet>)}
            </ul>
          </div>
        ))}
      </div>

      <H2 eyebrow="02 · Customer insights">Customer discovery — six themes from 21 industry leaders</H2>
      <div className="grid md:grid-cols-3 gap-4">
        {six.map(([t, d], i) => (
          <div key={t} className="bg-white border p-5" style={{ borderColor: LINE }}>
            <NumBadge n={"0" + (i + 1)} />
            <div className="font-bold text-base mt-3 mb-2" style={{ fontFamily: SERIF, color: INK }}>{t}</div>
            <div className="text-sm text-gray-700 leading-6">{d}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm">
        <button className="underline mr-4" style={{ color: INK }} onClick={() => go("interviews")}>See the full interview study — roster, ROCE rankings, Q4–Q20 findings</button>
        <button className="underline" style={{ color: INK }} onClick={() => go("insights")}>See the coded insights and the eight non-negotiable conditions</button>
      </div>

      <H2 eyebrow="02 · Research & industry insights">The white space Gift Re is built to fill</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {gaps.map(([t, d], i) => (
          <div key={t} className="bg-white border p-5 flex gap-4" style={{ borderColor: LINE }}>
            <div className="text-4xl font-bold flex-shrink-0" style={{ fontFamily: SERIF, color: GOLD }}>0{i + 1}</div>
            <div><div className="font-bold text-base mb-1" style={{ fontFamily: SERIF, color: INK }}>{t}</div><div className="text-sm text-gray-700 leading-6">{d}</div></div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-sm"><button className="underline" style={{ color: INK }} onClick={() => go("paper")}>Read the literature review and full paper chapters</button></div>
    </div>
  );
}

/* -------------------- 03 · Solution Propositions & Evidence -------------------- */

function SPCard({ code, text, constructs, methods, metrics }) {
  return (
    <div className="mb-6">
      <div className="text-white p-6 md:flex gap-6 items-center mb-4" style={{ background: INK, borderLeft: `8px solid ${GOLD}` }}>
        <div className="text-5xl font-bold flex-shrink-0" style={{ fontFamily: SERIF, color: GOLD }}>{code}</div>
        <div className="italic leading-7" style={{ fontFamily: SERIF, fontSize: 17 }}>{text}</div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[["Constructs", constructs], ["Methods", methods], ["Success metrics", metrics]].map(([t, items]) => (
          <div key={t} className="bg-white border" style={{ borderColor: LINE }}>
            <div className="px-5 py-3 font-bold text-lg" style={{ background: PANEL, fontFamily: SERIF, color: INK }}>{t}</div>
            <ul className="p-5 text-sm text-gray-700">{items.map((x) => <Bullet key={x}>{x}</Bullet>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Part3({ go }) {
  return (
    <div>
      <PageHeader eyebrow="Part three" title="Solution Propositions & Evidence" sub="Two solution propositions — ML-driven investment alpha and improved CAT pricing — validated through 21 expert interviews and backtesting of the investment MVP." />

      <H2 eyebrow="03 · Solution propositions">Solution Proposition 1 — ML for better alpha and superior risk-adjusted returns on float</H2>
      <SPCard code="SP1"
        text={<span><span className="font-bold">Machine-learning-based investment management of reinsurance float</span> — using models such as BiLSTM, CNNs, Random Forests and Temporal Fusion Transformers — applied and compared with traditional benchmark indices <span style={{ color: GOLD }}>to see if ML models can generate superior risk-adjusted returns</span>.</span>}
        constructs={["Reinsurance float (pooled investable assets)", "Risk-adjusted return (Sharpe, Treynor)", "Solvency & liquidity constraints", "Business-cycle regime"]}
        methods={["BiLSTM, CNN, Random Forest, Logistic regression", "16 + 4 years (training + testing) of data on the top 1,000 NSE companies by market cap", "Quarterly rebalanced portfolio", "Portfolio optimised via Sharpe"]}
        metrics={["CAGR vs Nifty 200 factor indices", "Sharpe / Treynor uplift", "Jensen's Alpha and Information Ratio", "ROCE improvement under RBC"]} />

      <H2 eyebrow="03 · Validation evidence · SP1">16-quarter backtest — ML beats every factor index</H2>
      <Table head={["Strategy", "CAGR", "Std dev", "Beta", "TE", "Sharpe", "Treynor", "Alpha", "IR"]}
        rows={[
          ["Nifty 50 (benchmark)", "12.3%", "13.0%", "1.00", "0.0%", "0.46", "0.06", "0.0%", "—"],
          ["Nifty 200 Quality 30", "12.0%", "16.8%", "1.23", "5.8%", "0.37", "0.05", "-1.1%", "0.04"],
          ["Nifty 200 Momentum 30", "15.5%", "23.2%", "1.57", "13.3%", "0.47", "0.07", "1.4%", "0.36"],
          ["Nifty 200 Alpha 30", "20.9%", "26.3%", "1.83", "15.4%", "0.62", "0.09", "5.3%", "0.67"],
          ["Nifty 200 Value 30", "27.1%", "20.9%", "1.24", "13.5%", "0.96", "0.16", "12.7%", "1.04"],
          ["Gift Re · BiLSTM Top 30", "43.7%", "33.8%", "2.30", "23.1%", "1.08", "0.16", "22.7%", "1.32"],
        ]} highlightLast />
      <Table caption="After the backtest — the next five quarters (quarterly returns, from the QoQ sheet of the 29 Sep supporting file)"
        head={["Quarter", "BiLSTM Top 30", "Nifty 50", "Quality 30", "Momentum 30", "Value 30"]}
        rows={[
          ["Q4 FY25", "-5.1%", "-1.3%", "-0.8%", "-2.8%", "-3.1%"],
          ["Q1 FY26", "6.9%", "7.3%", "4.7%", "8.5%", "13.8%"],
          ["Q2 FY26", "14.9%", "-3.9%", "-5.6%", "-2.4%", "14.2%"],
          ["Q3 FY26", "-1.4%", "-6.5%", "-0.2%", "-2.9%", "-4.0%"],
          ["Q4 FY26", "8.6%", "2.3%", "2.3%", "2.9%", "-4.2%"],
          ["CAGR, 20 quarters (Q4 FY21–Q3 FY26)", "37.4%", "8.6%", "9.0%", "12.2%", "25.8%"],
        ]} highlightLast={false} />
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="p-5" style={{ background: PANEL }}>
          <div className="text-xs mb-3" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Assumptions</div>
          {[["Risk-free rate", "6.5%"], ["Lag", "60 days"], ["Selection funnel", "1000 → 100 → 30"], ["Rebalancing", "Quarterly"]].map(([a, b]) => (
            <div key={a} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: LINE }}><span className="text-gray-600">{a}</span><span className="font-semibold" style={{ color: INK }}>{b}</span></div>
          ))}
        </div>
        <BigStat value="+31.4 pp" label="CAGR vs Nifty 50" sub="43.7% vs 12.3%" dark />
        <BigStat value="22.7%" label="Risk-adjusted alpha" sub="Jensen's α · IR of 1.32" dark />
      </div>
      <div className="bg-white border p-5 mb-4" style={{ borderColor: LINE }}>
        <div className="text-xs mb-3" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>How the model works</div>
        <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-700">
          {["13 factor parameters (X1–X13) on the Nifty 200 universe", "Train BiLSTM to predict the top-100-of-1000 performers", "Investment manager shortlists 30 stocks based on his analysis", "Stock weights set by risk-return optimisation using Sharpe or Treynor ratios"].map((t, i) => (
            <div key={i} className="flex gap-3"><Circle n={i + 1} /><span className="leading-6">{t}</span></div>
          ))}
        </div>
      </div>
      <Note>Higher beta and tracking error reflect active deviation from the index by design — translated into materially higher alpha and information ratio. Explore the quarterly series and what the returns are worth to a reinsurer's ROCE in <button className="underline font-semibold" style={{ color: INK }} onClick={() => go("model-a")}>Model A</button>.</Note>

      <H2 eyebrow="03 · Solution propositions">Solution Proposition 2 — Synthetic CAT pricing for rare & emerging risks</H2>
      <SPCard code="SP2"
        text={<span>When pricing rare or emerging risks, <span className="font-bold">synthetic data generated through GANs and Variational Autoencoders</span> will be used alongside real data to understand if it can improve the <span style={{ color: GOLD }}>accuracy, stability and fairness</span> of risk pricing compared with traditional actuarial and catastrophe-modelling techniques.</span>}
        constructs={["Rare-event frequency & severity", "Tail distribution of losses", "Probable Maximum Loss (PML)", "Pricing stability across cycles"]}
        methods={["GANs, VAEs, WGAN-GP, hybrid models", "EVT-calibrated synthetic scenarios", "Geospatial + demographic + claims data", "Hybrid ML → GLM for explainability"]}
        metrics={["Tail-loss prediction error vs traditional CAT", "Premium stability across market cycles", "Reduction in adverse-deviation margin", "Protection-gap closure (tier-3/4 markets)"]} />
      <Note>SP2 is grounded in EVT theory and validated through the expert interviews; the GAN/VAE pricing pilot is the next research phase. <button className="underline font-semibold" style={{ color: INK }} onClick={() => go("model-b")}>Model B</button> shows the EVT-calibrated scenario structure the pilot will plug into.</Note>
    </div>
  );
}
/* -------------------- Paper reader -------------------- */

function Paper() {
  const [active, setActive] = useState(CHAPTERS[0].id);
  const ch = CHAPTERS.find((c) => c.id === active);
  return (
    <div>
      <PageHeader eyebrow="Evidence base" title="Research paper" sub="A curated, chapter-by-chapter reading of the submission. The complete text, all 37 tables and 10 figures are in the attached document." />
      <div className="md:flex gap-8">
        <div className="md:w-56 flex-shrink-0 mb-6">
          {CHAPTERS.map((c, i) => (
            <button key={c.id} onClick={() => setActive(c.id)}
              className={"block w-full text-left text-sm py-1.5 px-2 border-l-2 " + (c.id === active ? "font-semibold bg-white" : "text-gray-600 hover:text-gray-900")}
              style={{ borderColor: c.id === active ? INK : "transparent" }}>
              <span className="text-gray-400 mr-2">{i + 1}</span>{c.title}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl mb-4" style={{ fontFamily: SERIF, color: INK }}>{ch.title}</h2>
          {ch.body.map((p, i) => <P key={i}>{p}</P>)}
          {ch.table && <Table {...ch.table} highlightLast={ch.id === "backtest"} />}
          <div className="flex justify-between text-sm mt-8 max-w-2xl">
            {CHAPTERS.indexOf(ch) > 0
              ? <button className="underline text-gray-700" onClick={() => setActive(CHAPTERS[CHAPTERS.indexOf(ch) - 1].id)}>Previous chapter</button> : <span />}
            {CHAPTERS.indexOf(ch) < CHAPTERS.length - 1
              ? <button className="underline text-gray-700" onClick={() => setActive(CHAPTERS[CHAPTERS.indexOf(ch) + 1].id)}>Next chapter</button> : <span />}
          </div>
        </div>
      </div>
    </div>
  );
}

function RankCell({ v }) {
  const n = parseInt(v); const shade = isNaN(n) ? "#fff" : `rgba(30,110,140,${(1 - (n - 1) / 9) * 0.75})`;
  return <td className="px-1 py-1 text-center text-xs" style={{ background: shade, color: !isNaN(n) && n <= 3 ? "white" : INK }}>{v}</td>;
}

function Interviews() {
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const list = QUESTIONS.filter((q) => filter === "All" || q.h === filter || q.h === "Both");
  const totalExp = ROSTER.reduce((s, r) => s + r[3], 0);
  return (
    <div>
      <PageHeader eyebrow="Evidence base" title="Interviews" sub="Twenty-one senior professionals interviewed with a 20-question instrument approved by the Golden Gate University IRB. Rankings were tested statistically; transcripts were coded against 25 themes and scored for attitude." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mb-8">
        <Stat label="Participants" value="21" note="13 insurers · 4 reinsurers · 3 consultants · 1 former regulator" />
        <Stat label="Combined experience" value={totalExp + " yrs"} note={"about " + Math.round(totalExp / 21) + " years each; none under 15"} />
        <Stat label="Questions" value="20" note="Q5–Q10 asset side · Q11–Q17 liability side · Q18–Q20 outlook" />
        <Stat label="Themes coded" value="25" note="each interview touched 22 on average" />
      </div>

      <H2>Who was interviewed</H2>
      <Table caption="Appendix C — participant roster" head={["Participant", "Role / organisation", "Domain", "Experience (yrs)"]}
        rows={ROSTER.map((r) => [r[0], r[1], r[2], r[3]])} />
      <P>ML familiarity was mixed: roughly a third rated themselves high, the rest spread across moderate, basic and low — and the more familiar a respondent was, the more receptive they were (Spearman ρ = 0.47, p = 0.03).</P>

      <H2>What drives ROCE (Q4)</H2>
      <P>Each respondent ranked ten profitability drivers from 1 (most critical) to 10. A clear three-tier pattern emerged, and agreement across respondents is statistically significant (Kendall's W = 0.36, p &lt; 0.001). One consultant gave narrative answers instead of ranks, so 20 rankings are used.</P>
      <div className="bg-white border border-gray-300 p-3 mb-4 max-w-3xl">
        <div className="text-sm text-gray-600 mb-2">Mean rank — shorter bars are more critical. Tiers: top (navy), middle (marine), bottom (grey)</div>
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={ROCE_DRIVERS} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="driver" width={220} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => v.toFixed(2)} />
            <Bar dataKey="mean" name="Mean rank">
              {ROCE_DRIVERS.map((d, i) => <Cell key={i} fill={TIER_COLOR[d.tier]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table caption="Table 1 — ROCE driver rankings (20 respondents)" head={["Driver", "Mean rank", "Median", "Std dev", "Top-3 frequency"]}
        rows={ROCE_DRIVERS.map((d) => [d.driver, d.mean.toFixed(2), d.median.toFixed(1), d.sd.toFixed(2), `${d.top3} / 20 (${d.top3 * 5}%)`])} />
      <P>Investment and float management sits in the middle tier — fourth overall, and the most consistently ranked driver (lowest standard deviation, 1.57). That is consistent with the paper: float is a real lever, but pricing and underwriting come first.</P>
      <button onClick={() => setShowMatrix(!showMatrix)} className="text-sm underline mb-4" style={{ color: INK }}>{showMatrix ? "Hide" : "Show"} the respondent-by-respondent ranking matrix (Appendix B)</button>
      {showMatrix && (
        <div className="overflow-x-auto border border-gray-300 bg-white mb-6 max-w-3xl">
          <table className="w-full text-xs">
            <thead><tr style={{ background: INK, color: "white" }}>
              <th className="px-2 py-1 text-left">Participant</th><th className="px-2 py-1 text-left">Type</th>
              {RANK_COLS.map((c) => <th key={c} className="px-1 py-1 text-center">{c}</th>)}
            </tr></thead>
            <tbody>{RANK_MATRIX.map((r) => (
              <tr key={r[0]} className="border-t border-gray-200"><td className="px-2 py-1">{r[0]}</td><td className="px-2 py-1 text-gray-600">{r[1]}</td>
                {r.slice(2).map((v, i) => <RankCell key={i} v={v} />)}</tr>
            ))}</tbody>
          </table>
          <div className="text-xs text-gray-500 p-2">PA pricing accuracy · UD underwriting discipline · RS risk selection · IR investment/float · TM technology maturity · OE operating efficiency · DO digital onboarding · PD product design · MB marketing · CRM retention. * ties resolved by mean rank.</div>
        </div>
      )}

      <H2>Question-by-question findings</H2>
      <div className="flex gap-2 mb-4 text-sm">
        {["All", "H1", "H2"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"px-3 py-1 border " + (filter === f ? "text-white" : "bg-white text-gray-700")}
            style={filter === f ? { background: f === "H2" ? RUST : f === "H1" ? MARINE : INK, borderColor: "transparent" } : { borderColor: "#ccc" }}>
            {f === "All" ? "All questions" : f === "H1" ? "H1 · Investment & float" : "H2 · Synthetic data & pricing"}
          </button>
        ))}
      </div>
      <div className="max-w-3xl">
        {list.map((q) => {
          const isOpen = open === q.q;
          const col = q.h === "H1" ? MARINE : q.h === "H2" ? RUST : INK;
          return (
            <div key={q.q} className="border-b border-gray-300 bg-white">
              <button onClick={() => setOpen(isOpen ? null : q.q)} className="w-full text-left px-4 py-3 flex items-baseline gap-3">
                <span className="text-sm w-16 flex-shrink-0" style={{ color: col }}>{q.q}</span>
                <span className="font-medium flex-1" style={{ color: INK }}>{q.title}</span>
                <span className="text-gray-400 text-sm">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen && <div className="px-4 pb-4 pl-24 text-sm text-gray-800 leading-6">{q.finding}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- Insights -------------------- */

function Insights() {
  const codes = [...CODEBOOK].sort((a, b) => b[2] - a[2]).map(([c, t, f]) => ({ code: c, theme: t, n: f, pct: Math.round(f / 21 * 100) }));
  return (
    <div>
      <PageHeader eyebrow="Evidence base" title="Insights" sub="What the 21 interviews say about the two hypotheses, and the conditions every respondent attached to them." />

      <div className="grid md:grid-cols-2 gap-6 mb-8 max-w-3xl">
        <div className="bg-white border p-5" style={{ borderLeft: `4px solid ${MARINE}` }}>
          <div className="text-sm text-gray-500">Hypothesis 1 — ML for float and asset management</div>
          <div className="text-4xl my-1" style={{ fontFamily: SERIF, color: MARINE }}>86%</div>
          <div className="text-sm text-gray-700">18 of 21 agreed ML can improve allocation, stock selection or float management and lift ROCE. Supported — with the upside bounded by IRDAI asset rules, data quality and the need for human oversight and explainability. Reinsurers, who carry the largest float, were the most positive.</div>
        </div>
        <div className="bg-white border p-5" style={{ borderLeft: `4px solid ${RUST}` }}>
          <div className="text-sm text-gray-500">Hypothesis 2 — synthetic data for rare-risk pricing</div>
          <div className="text-4xl my-1" style={{ fontFamily: SERIF, color: RUST }}>90%</div>
          <div className="text-sm text-gray-700">19 of 21 saw real promise; 95% also raised concerns, 86% noted tail events cannot be back-tested, and 100% demanded explainability. Supported under stricter conditions: augment rather than replace expert judgment, model only what is partly understood, keep the whole chain from data to price auditable.</div>
        </div>
      </div>

      <H2>The eight non-negotiable conditions</H2>
      <P>Eight themes were raised by every single respondent. Together they are the study's main contribution: the terms on which ML and synthetic data are acceptable to the industry's most experienced people.</P>
      <div className="grid md:grid-cols-2 gap-2 max-w-3xl mb-8">
        {CONDITIONS.map((c) => (
          <div key={c} className="bg-white border border-gray-300 px-4 py-2 text-sm flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 text-white" style={{ background: INK }}>21 / 21</span>{c}
          </div>
        ))}
      </div>

      <H2>Theme frequency across the 25 codes</H2>
      <div className="bg-white border border-gray-300 p-3 mb-4 max-w-3xl">
        <div className="text-sm text-gray-600 mb-2">Number of interviews (of 21) in which each theme appeared. Dark bars were raised by everyone.</div>
        <ResponsiveContainer width="100%" height={640}>
          <BarChart data={codes} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" domain={[0, 21]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="theme" width={230} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n, p) => [`${v} / 21 (${p.payload.pct}%)`, "Interviews"]} />
            <Bar dataKey="n" name="Interviews">
              {codes.map((c, i) => <Cell key={i} fill={c.n === 21 ? INK : c.n >= 18 ? MARINE : "#9AAAB8"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {[["H1", "Asset side — what supports and what constrains H1", MARINE], ["H2", "Liability side — what supports and what constrains H2", RUST]]
        .map(([k, title, color]) => (
          <div key={k} className="mb-8">
            <H2 color={color}>{title}</H2>
            <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
              {THEMES[k].map((t) => (
                <div key={t.t} className="bg-white border border-gray-300 p-4">
                  <Chip color={t.stance === "supports" ? "#2F7D5B" : "#B8860B"}>{t.stance === "supports" ? "Supports" : "Cautions"}</Chip>
                  <div className="font-semibold mt-2 mb-1" style={{ color: INK }}>{t.t}</div>
                  <div className="text-sm text-gray-700">{t.d}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

      <H2>Cross-cutting findings</H2>
      <P><span className="font-semibold">Familiarity breeds acceptance.</span> Receptiveness to ML rose with self-rated familiarity (Spearman ρ = 0.47, p = 0.03). Some resistance is unfamiliarity, so training — through actuarial societies and universities — is itself an adoption lever, not just a precondition.</P>
      <P><span className="font-semibold">The barrier is one system.</span> Respondents who raised talent scarcity also tended to raise cultural resistance, cost and the hybrid path: practitioners see adoption as a connected problem rather than separate hurdles.</P>
      <P><span className="font-semibold">Hybrid beats AI-native.</span> 90% favoured established firms adopting AI-native ways of working over displacement by new entrants. An AI-native reinsurer has real advantages — clean data, staff built around the model, governance designed in — but reinsurance is a trust-, capital- and relationship-intensive business that takes years to build. Reinsurers were most optimistic; consultants most cautious, citing rating-agency credibility. The regulator is technology-neutral but would scrutinise a new entrant's risk-based capital more closely.</P>
      <P><span className="font-semibold">One balance sheet.</span> Several respondents named the integration of asset and liability modelling — treating a catastrophe's claims and its market shock as one event — as the most powerful use of ML. That is the bridge between Model A and Model B in this portal.</P>
      <P><span className="font-semibold">Explainability limits the method.</span> Pricing should use interpretable models — GLMs, or gradient-boosted trees with SHAP explanations — rather than opaque deep networks. Several respondents also warned synthetic data could reduce fairness by carrying forward hidden bias.</P>

      <H2>Limitations</H2>
      <P>The sample is concentrated in India, so regulatory comments are IRDAI-specific, and skews toward long-duration life and health rather than short-tail general insurance. All coding was by one person; a second coder on about 30% of transcripts is recommended for the full dissertation. Attitude scores are interpretive, and the study is a snapshot.</P>
    </div>
  );
}

/* -------------------- Model A: Investment & float -------------------- */

function cumulative(arr) {
  let v = 100; return arr.map((r) => { v = v * (1 + r / 100); return +v.toFixed(2); });
}
function maxDrawdown(cum) {
  let peak = cum[0], mdd = 0;
  cum.forEach((v) => { if (v > peak) peak = v; mdd = Math.min(mdd, (v - peak) / peak); });
  return mdd * 100;
}

function BacktestExplorer() {
  const names = Object.keys(RET);
  const [shown, setShown] = useState({ "BiLSTM Top 30": true, "Nifty 50": true, "Quality 30": false, "Momentum 30": false, "Value 30": true });
  const cums = useMemo(() => Object.fromEntries(names.map((n) => [n, cumulative(RET[n])])), []);
  const growth = QUARTERS.map((q, i) => { const o = { q }; names.forEach((n) => (o[n] = cums[n][i])); return o; });
  const bars = QUARTERS.map((q, i) => ({ q, "BiLSTM Top 30": RET["BiLSTM Top 30"][i], "Nifty 50": RET["Nifty 50"][i] }));
  const stats = names.map((n) => {
    const c = cums[n]; const end = c[c.length - 1];
    const cagr = (Math.pow(end / 100, 1 / 4) - 1) * 100;
    const wins = RET[n].filter((r, i) => r > RET["Nifty 50"][i]).length;
    return { n, end, cagr, mdd: maxDrawdown(c), wins, worst: Math.min(...RET[n]) };
  });
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 text-sm">
        {names.map((n) => (
          <button key={n} onClick={() => setShown({ ...shown, [n]: !shown[n] })}
            className="px-3 py-1 border" style={{ borderColor: SERIES_COLORS[n], color: shown[n] ? "white" : SERIES_COLORS[n], background: shown[n] ? SERIES_COLORS[n] : "white" }}>{n}</button>
        ))}
      </div>
      <div className="bg-white border border-gray-300 p-3 mb-4">
        <div className="text-sm text-gray-600 mb-2">Growth of 100 invested at the start of Q4 FY21, quarterly rebalancing, out-of-sample</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={growth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#eee" />
            <XAxis dataKey="q" tick={{ fontSize: 11 }} interval={3} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => v.toFixed(1)} />
            <Legend />
            {names.filter((n) => shown[n]).map((n) => (
              <Line key={n} type="monotone" dataKey={n} stroke={SERIES_COLORS[n]} strokeWidth={n === "BiLSTM Top 30" ? 3 : 1.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white border border-gray-300 p-3 mb-4">
        <div className="text-sm text-gray-600 mb-2">Quarterly return, BiLSTM Top 30 versus Nifty 50 (%)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bars} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#eee" />
            <XAxis dataKey="q" tick={{ fontSize: 11 }} interval={3} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <ReferenceLine y={0} stroke="#999" />
            <Bar dataKey="BiLSTM Top 30" fill={GOLD} />
            <Bar dataKey="Nifty 50" fill={INK} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table caption="Computed from the quarterly series in Table 14 (4 years, 16 quarters)"
        head={["Strategy", "End value of 100", "CAGR", "Max drawdown", "Worst quarter", "Quarters beating Nifty 50"]}
        rows={stats.map((s) => [s.n, s.end.toFixed(0), s.cagr.toFixed(1) + "%", s.mdd.toFixed(1) + "%", s.worst.toFixed(1) + "%", s.n === "Nifty 50" ? "—" : `${s.wins} / 16`])}
        highlightLast={false} />
      <Note color={MARINE}>The strategy outperformed in 13 of 16 quarters but with a beta of 2.30 and a 34% standard deviation — the drawdown in Q2 FY25 (−21.8%) is the kind of quarter a reinsurer's liquidity buffer must absorb. That trade-off is what the float simulator below is for.</Note>
    </div>
  );
}

const RBC = { cash: 0.0, bonds: 0.03, equity: 0.35 };
const YIELD = { cash: 5.5, bonds: 7.2 };

function FloatSimulator() {
  const [year, setYear] = useState(1);
  const [mult, setMult] = useState(1.0);
  const [cash, setCash] = useState(40);
  const [bonds, setBonds] = useState(50);
  const [engine, setEngine] = useState("bilstm");
  const [haircut, setHaircut] = useState(50);
  const [stress, setStress] = useState(1.5);

  const eq = Math.max(0, 100 - cash - bonds);
  const p = PNL[year];
  const float = p.gwp * mult;
  const eqRaw = engine === "bilstm" ? 43.7 : 12.3;
  const eqYield = eqRaw * (1 - haircut / 100);
  const inc = { cash: float * cash / 100 * YIELD.cash / 100, bonds: float * bonds / 100 * YIELD.bonds / 100, equity: float * eq / 100 * eqYield / 100 };
  const invIncome = inc.cash + inc.bonds + inc.equity;
  const assetCharge = float * (cash / 100 * RBC.cash + bonds / 100 * RBC.bonds + eq / 100 * RBC.equity);
  const capital = p.capital + assetCharge;
  const roce = (p.uw + invIncome) / capital * 100;
  const baseRoce = (p.uw + p.invPaper) / p.capital * 100;
  const liquid = float * (cash / 100 + bonds / 100 * 0.5);
  const stressedQuarterClaims = p.claims / 4 * stress;
  const cover = liquid / stressedQuarterClaims;

  const scenarios = useMemo(() => {
    const out = [];
    for (let c = 10; c <= 90; c += 10) {
      const b = Math.min(bonds, 100 - c); const e = 100 - c - b;
      const ii = float * (c / 100 * YIELD.cash / 100 + b / 100 * YIELD.bonds / 100 + e / 100 * eqYield / 100);
      const ch = float * (b / 100 * RBC.bonds + e / 100 * RBC.equity);
      out.push({ cash: c + "%", ROCE: +((p.uw + ii) / (p.capital + ch) * 100).toFixed(1), Cover: +((float * (c / 100 + b / 200)) / stressedQuarterClaims).toFixed(2) });
    }
    return out;
  }, [bonds, float, eqYield, p, stressedQuarterClaims]);

  return (
    <div className="md:flex gap-8">
      <div className="md:w-72 flex-shrink-0 bg-white border border-gray-300 p-4 mb-6">
        <div className="text-sm text-gray-600 mb-3">Plan year</div>
        <div className="flex gap-2 mb-5">
          {[1, 2, 3].map((y) => (
            <button key={y} onClick={() => setYear(y)} className="flex-1 py-1 border text-sm"
              style={year === y ? { background: MARINE, color: "white", borderColor: MARINE } : { borderColor: "#ccc" }}>Year {y}</button>
          ))}
        </div>
        <Slider label="Float as multiple of gross premium" value={mult} min={0.25} max={3} step={0.1} onChange={setMult} fmt={(v) => v.toFixed(1) + "x"} color={MARINE} />
        <Slider label="Cash and money market" value={cash} min={0} max={100} onChange={(v) => { setCash(v); if (v + bonds > 100) setBonds(100 - v); }} fmt={(v) => v + "%"} color={MARINE} />
        <Slider label="Government and corporate bonds" value={bonds} min={0} max={100 - cash} onChange={setBonds} fmt={(v) => v + "%"} color={MARINE} />
        <div className="text-sm text-gray-700 mb-4">Equity (remainder): <span className="font-semibold" style={{ color: MARINE }}>{eq}%</span></div>
        <div className="text-sm text-gray-600 mb-2">Equity engine</div>
        <div className="flex gap-2 mb-4 text-sm">
          <button onClick={() => setEngine("bilstm")} className="flex-1 py-1 border" style={engine === "bilstm" ? { background: MARINE, color: "white", borderColor: MARINE } : { borderColor: "#ccc" }}>BiLSTM Top 30</button>
          <button onClick={() => setEngine("index")} className="flex-1 py-1 border" style={engine === "index" ? { background: INK, color: "white", borderColor: INK } : { borderColor: "#ccc" }}>Nifty 50 index</button>
        </div>
        <Slider label="Haircut on backtested equity return" value={haircut} min={0} max={90} step={5} onChange={setHaircut} fmt={(v) => v + "%"} color={MARINE} />
        <Slider label="Catastrophe quarter: claims multiple" value={stress} min={1} max={4} step={0.25} onChange={setStress} fmt={(v) => v.toFixed(2) + "x"} color={MARINE} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          <Stat label="Investable float" value={"$" + float.toFixed(0) + "M"} note={`GWP $${p.gwp}M × ${mult.toFixed(1)}`} />
          <Stat label="Investment income" value={"$" + invIncome.toFixed(1) + "M"} note={`Paper assumes $${p.invPaper}M`} color={MARINE} />
          <Stat label="ROCE" value={roce.toFixed(1) + "%"} note={`Paper base case ${baseRoce.toFixed(1)}%`} color={MARINE} />
          <Stat label="Liquidity cover" value={cover.toFixed(2) + "x"} note="Liquid assets ÷ stressed quarter of claims" color={cover < 1 ? RUST : "#2F7D5B"} />
        </div>
        <div className="bg-white border border-gray-300 p-3 mb-4">
          <div className="text-sm text-gray-600 mb-2">ROCE and liquidity cover as the cash allocation changes (bond share held at {bonds}% where possible)</div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={scenarios} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="cash" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} unit="%" />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} unit="x" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="l" dataKey="ROCE" fill={MARINE} name="ROCE %" />
              <Line yAxisId="r" dataKey="Cover" stroke={RUST} strokeWidth={2} name="Liquidity cover (x)" />
              <ReferenceLine yAxisId="r" y={1} stroke={RUST} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <Table caption="Income and capital charge by asset class (USD million, illustrative RBC charges: cash 0%, bonds 3%, equity 35%)"
          head={["Asset class", "Allocation", "Yield", "Income", "Capital charge"]}
          rows={[
            ["Cash and money market", cash + "%", YIELD.cash + "%", inc.cash.toFixed(2), (float * cash / 100 * RBC.cash).toFixed(2)],
            ["Bonds", bonds + "%", YIELD.bonds + "%", inc.bonds.toFixed(2), (float * bonds / 100 * RBC.bonds).toFixed(2)],
            ["Equity (" + (engine === "bilstm" ? "BiLSTM" : "index") + ")", eq + "%", eqYield.toFixed(1) + "%", inc.equity.toFixed(2), (float * eq / 100 * RBC.equity).toFixed(2)],
            ["Total", "100%", (invIncome / float * 100).toFixed(1) + "%", invIncome.toFixed(2), assetCharge.toFixed(2)],
          ]} highlightLast />
      </div>
    </div>
  );
}

function ModelA({ go }) {
  return (
    <div>
      <PageHeader eyebrow="03 · Working model" title="Model A — Investment & fund management" sub="Two tools. The backtest explorer works only with the out-of-sample results reported in the paper. The float simulator shows what those returns are worth to a reinsurer once liquidity and risk-based capital are taken into account." />
      <Note color={MARINE}><span className="font-semibold">Status: simulation.</span> Figures come from Tables 12, 14 and 31 of the paper and from illustrative yield and capital-charge assumptions. When the BiLSTM notebook is attached, the explorer will read the model's own output file instead. Assumptions from the deck: risk-free 6.5%, 60-day lag, 1000 → 100 → 30 selection funnel, quarterly rebalancing.</Note>
      <H2 color={MARINE}>Backtest explorer</H2>
      <BacktestExplorer />
      <H2 color={MARINE}>Float allocation and ROCE simulator</H2>
      <P>Set the float, choose how it is split between cash, bonds and equity, and decide how much of the backtested equity return to trust. The tool returns investment income, capital charge, ROCE and how many stressed quarters of claims the liquid assets can cover — the constraint every interviewee raised first.</P>
      <FloatSimulator />

      <H2 color={MARINE} eyebrow="Working model">The models, end to end</H2>
      <P>
        The full working model — the four classifiers, the eight-step pipeline, the reported
        outputs and the data and model specs — is available as subsections
        of this page, followed by the production pipeline that turns a raw quarterly export into
        predictions.
      </P>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {WORKING_MODEL_SECTIONS.map((w) => (
          <button key={w.id} onClick={() => go(w.id)}
            className="text-left p-4 hover:bg-gray-50"
            style={{ background: "#fff", border: `1px solid ${LINE}`, borderTop: `4px solid ${GOLD}` }}>
            <span className="text-sm font-semibold" style={{ color: INK }}>
              <span className="mr-2" style={{ color: GOLD, fontFamily: SERIF }}>{w.num}</span>{w.label}
            </span>
            <span className="block mt-1 text-xs text-gray-600 leading-5">{w.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const WORKING_MODEL_SECTIONS = [
  { id: "wm-models",  num: "01", label: "The models",          blurb: "Logistic regression, random forest, CNN and BiLSTM as infographic cards, plus the comparison table." },
  { id: "wm-process", num: "02", label: "Process walkthrough", blurb: "The eight-step pipeline from the NSE universe to a 30-stock portfolio, and the overfitting safeguards." },
  { id: "wm-outputs", num: "03", label: "Model outputs",       blurb: "Table 13 classifier metrics, the Table 12 backtest and the growth-of-100 chart." },
  { id: "wm-spec",    num: "04", label: "Data & model specs",  blurb: "File layout, trained-artifact formats, the data-feed roadmap and governance hooks." },
  { id: "wm-outputs-check", num: "05", label: "Check outputs", blurb: "Pick any quarter from Q4FY21 on to see the model's stock-by-stock output, or upload a new quarter's base data and score it." },
];

/* -------------------- Model A working model (standalone page, embedded) --------------------
   The working model lives at working-model/index.html and stays standalone: it loads
   TensorFlow.js, SheetJS and Chart.js from CDNs, which are deliberately kept out of this
   bundle. Four of its pages are surfaced here as a Model A subsection via ?embed=1,
   which hides the standalone sidebar; the frame reports its height so there is no
   inner scrollbar. Editing the content means editing working-model/index.html.
------------------------------------------------------------------------------------------ */

const WM_SRC = "working-model/index.html";

function WorkingModelFrame({ page, src = WM_SRC, hash = true, linkLabel = "the standalone working model" }) {
  const [height, setHeight] = useState(1400);
  const frame = useRef(null);
  useEffect(() => {
    function onMsg(e) {
      const d = e.data;
      if (d && d.type === "gift-re-wm-height" && d.page === page && typeof d.height === "number") {
        setHeight(Math.max(600, Math.ceil(d.height) + 24));
      }
    }
    window.addEventListener("message", onMsg);
    // The frame may finish loading before this effect runs, so ask it for a height too.
    const ping = () => frame.current?.contentWindow?.postMessage({ type: "gift-re-wm-ping" }, "*");
    const timers = [0, 250, 900, 2000].map((t) => setTimeout(ping, t));
    return () => { window.removeEventListener("message", onMsg); timers.forEach(clearTimeout); };
  }, [page]);
  return (
    <div>
      <iframe
        ref={frame}
        onLoad={() => frame.current?.contentWindow?.postMessage({ type: "gift-re-wm-ping" }, "*")}
        title={"Gift Re working model — " + page}
        src={src + "?embed=1" + (hash ? "#" + page : "")}
        style={{ width: "100%", height, border: "none", display: "block" }}
      />
      <p className="mt-6 text-xs text-gray-500">
        This section is served from{" "}
        <a href={src + (hash ? "#" + page : "")} target="_blank" rel="noopener noreferrer"
           className="underline" style={{ color: MARINE }}>{linkLabel}</a>
        , which also runs on its own outside this portal.
      </p>
    </div>
  );
}

function WMModels()  { return <WorkingModelFrame page="models" />; }
function WMProcess() { return <WorkingModelFrame page="process" />; }
function WMOutputs() { return <WorkingModelFrame page="outputs" />; }
function WMSpec()    { return <WorkingModelFrame page="spec" />; }

/* Check outputs (check-outputs/index.html) reads the model_outputs table in Supabase through the
   local service (api/main.py, port 8100). Saved quarters load directly; any other quarter from Q4FY21
   to today offers an upload that is built into factors, scored, and can then be saved. */
function WMCheckOutputs() {
  return (
    <div>
      <PageHeader eyebrow="Model A · Working model · 05" title="Check outputs"
        sub="Choose a quarter from Q4FY21 to the current one to see how the model ranked every stock. For a quarter without results yet, upload its base data to score it." />
      <Note color={MARINE}>
        <span className="font-semibold">Status: live data.</span> Q4FY21 to Q4FY26 show the validated out-of-time output behind
        Table 12: every stock's probability, rank, Top 30 flag and realised outcome, with its current and next quarter price
        (60-day lag) and return, so you can see how many of the top N were real winners.
        Later quarters are scored from their base data: fundamentals from the upload, price factors from split-adjusted prices.
      </Note>
      <div className="mt-6">
        <WorkingModelFrame page="check-outputs" src="check-outputs/index.html" hash={false} linkLabel="the Check outputs page" />
      </div>
    </div>
  );
}

/* -------------------- Model B: Catastrophe event -------------------- */

const PERILS = {
  flood:      { label: "Riverine flood (Bihar / Assam analogue)", lambda: 1.2, scale: 0.006 },
  cyclone:    { label: "Coastal cyclone (Odisha / Andhra analogue)", lambda: 0.5, scale: 0.015 },
  earthquake: { label: "Earthquake (Himalayan belt)", lambda: 0.12, scale: 0.05 },
  cyber:      { label: "Systemic cyber event", lambda: 0.8, scale: 0.01 },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(rng, lam) {
  const L = Math.exp(-lam); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function gpd(rng, xi, scale) {
  const u = Math.max(rng(), 1e-12);
  return scale * (Math.pow(u, -xi) - 1) / xi;
}
function simulate({ peril, si, n, xi, seed }) {
  const rng = mulberry32(seed);
  const pr = PERILS[peril];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = poisson(rng, pr.lambda); let agg = 0;
    for (let j = 0; j < k; j++) agg += gpd(rng, xi, pr.scale * si);
    out[i] = Math.min(agg, si);
  }
  return out;
}
function quantileDesc(sorted, rp) { // sorted descending
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length / rp));
  return sorted[idx];
}
function layerLoss(x, A, L) { return Math.min(Math.max(x - A, 0), L); }
function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function std(a) { const m = mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2; return Math.sqrt(s / a.length); }

function CatModel() {
  const [peril, setPeril] = useState("flood");
  const [si, setSi] = useState(5000);
  const [n, setN] = useState(10000);
  const [xi, setXi] = useState(0.35);
  const [hist, setHist] = useState(15);
  const [attach, setAttach] = useState(4);
  const [limit, setLimit] = useState(10);
  const [seed, setSeed] = useState(6894);

  const res = useMemo(() => {
    const losses = simulate({ peril, si, n, xi, seed });
    const sorted = Array.from(losses).sort((a, b) => b - a);
    const A = si * attach / 100, L = si * limit / 100;
    const layer = losses.map((x) => layerLoss(x, A, L));
    const el = mean(losses), elLayer = mean(layer);
    const rps = [2, 5, 10, 20, 50, 100, 200, 250, 500, 1000].filter((r) => r <= n);
    const ep = rps.map((r) => ({ rp: r, loss: +quantileDesc(sorted, r).toFixed(1), label: "1-in-" + r }));
    // "Traditional" actuary sees only `hist` years of history: bootstrap windows for stability
    const rngB = mulberry32(seed + 1);
    const tradEst = [];
    for (let b = 0; b < 40; b++) {
      let s = 0;
      for (let i = 0; i < hist; i++) s += layer[Math.floor(rngB() * n)];
      tradEst.push(s / hist);
    }
    const margin = 0.3 + 2 / Math.sqrt(hist);
    const floor = 0.004 * L;
    const tradRaw = mean(tradEst);
    const tradPremium = Math.max(tradRaw, floor) * (1 + margin);
    const tradCV = tradRaw > 0 ? std(tradEst) / tradRaw : 1;
    // Synthetic-augmented: full distribution + expense/profit load + model-risk load
    const synPremium = elLayer * (1 + 0.15 + 0.10);
    // stability of synthetic estimate across 40 sub-samples of 2000 scenarios
    const rngS = mulberry32(seed + 2); const synEst = [];
    for (let b = 0; b < 40; b++) { let s = 0; for (let i = 0; i < 2000; i++) s += layer[Math.floor(rngS() * n)]; synEst.push(s / 2000); }
    const synCV = elLayer > 0 ? std(synEst) / elLayer : 0;
    // histogram up to the 1-in-100 loss
    const cap = quantileDesc(sorted, 100) || 1; const bins = 20; const hcounts = new Array(bins).fill(0); let zero = 0;
    losses.forEach((x) => { if (x === 0) { zero++; return; } const b = Math.min(bins - 1, Math.floor(x / cap * bins)); hcounts[b]++; });
    const histo = hcounts.map((c, i) => ({ bucket: (i * cap / bins).toFixed(0), years: c }));
    return { el, elLayer, ep, pml100: quantileDesc(sorted, 100), pml200: quantileDesc(sorted, 200), tradPremium, synPremium, tradCV, synCV, margin, L, histo, zero, meanEvents: PERILS[peril].lambda };
  }, [peril, si, n, xi, hist, attach, limit, seed]);

  const rol = (p) => (p / res.L * 100).toFixed(2) + "%";
  const diff = ((res.tradPremium - res.synPremium) / res.synPremium * 100);

  return (
    <div className="md:flex gap-8">
      <div className="md:w-72 flex-shrink-0 bg-white border border-gray-300 p-4 mb-6">
        <div className="text-sm text-gray-600 mb-2">Peril</div>
        <select value={peril} onChange={(e) => setPeril(e.target.value)} className="w-full border border-gray-300 p-2 text-sm mb-4 bg-white">
          {Object.entries(PERILS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Slider label="Exposure — sum insured (USD M)" value={si} min={500} max={20000} step={500} onChange={setSi} fmt={(v) => "$" + v.toLocaleString() + "M"} color={RUST} />
        <Slider label="Synthetic scenario years" value={n} min={1000} max={20000} step={1000} onChange={setN} fmt={(v) => v.toLocaleString()} color={RUST} />
        <Slider label="Tail heaviness (GPD shape ξ)" value={xi} min={0.1} max={0.6} step={0.05} onChange={setXi} fmt={(v) => v.toFixed(2)} color={RUST} />
        <Slider label="Real loss history available (years)" value={hist} min={5} max={50} onChange={setHist} fmt={(v) => v + " yrs"} color={RUST} />
        <div className="text-sm text-gray-600 mt-2 mb-2">Excess-of-loss layer</div>
        <Slider label="Attachment (% of sum insured)" value={attach} min={0.5} max={20} step={0.5} onChange={setAttach} fmt={(v) => v + "%"} color={RUST} />
        <Slider label="Limit (% of sum insured)" value={limit} min={1} max={40} step={1} onChange={setLimit} fmt={(v) => v + "%"} color={RUST} />
        <button onClick={() => setSeed(seed + 1)} className="w-full py-2 text-sm text-white" style={{ background: RUST }}>Generate new scenario set</button>
        <div className="text-xs text-gray-500 mt-2">Seed {seed}. Same inputs and seed always reproduce the same scenarios.</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          <Stat label="Expected annual loss" value={"$" + res.el.toFixed(1) + "M"} note={`${res.meanEvents} events / yr on average; ${(res.zero / n * 100).toFixed(0)}% of years loss-free`} />
          <Stat label="1-in-100 year loss" value={"$" + res.pml100.toFixed(0) + "M"} color={RUST} />
          <Stat label="1-in-200 year loss (PML)" value={"$" + res.pml200.toFixed(0) + "M"} note="Solvency II / RBC calibration point" color={RUST} />
          <Stat label="Layer expected loss" value={"$" + res.elLayer.toFixed(2) + "M"} note={`${attach}% xs, ${limit}% limit`} />
        </div>

        <div className="bg-white border border-gray-300 p-3 mb-4">
          <div className="text-sm text-gray-600 mb-2">Exceedance probability curve — annual loss by return period (USD M)</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={res.ep} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="loss" stroke={RUST} fill={RUST} fillOpacity={0.15} name="Annual loss" />
              <ReferenceLine y={si * attach / 100} stroke={INK} strokeDasharray="4 4" label={{ value: "Attachment", fontSize: 11, position: "insideTopLeft" }} />
              <ReferenceLine y={si * (attach + limit) / 100} stroke={INK} strokeDasharray="4 4" label={{ value: "Exhaustion", fontSize: 11, position: "insideTopLeft" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-300 p-3">
            <div className="text-sm text-gray-600 mb-2">Distribution of loss years up to the 1-in-100 loss (USD M)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={res.histo} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="years" fill={RUST} name="Scenario years" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border border-gray-300 p-3">
            <div className="text-sm text-gray-600 mb-2">Layer premium — rate on line</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[{ name: "Traditional", rol: +(res.tradPremium / res.L * 100).toFixed(2) }, { name: "Synthetic-augmented", rol: +(res.synPremium / res.L * 100).toFixed(2) }]} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <Bar dataKey="rol" fill={INK} name="Rate on line %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Table caption="Two ways of pricing the same layer"
          head={["", "Traditional actuarial", "Synthetic-augmented (Gift Re)"]}
          rows={[
            ["Data used", `${hist} years of observed losses`, `${n.toLocaleString()} generated scenario years, EVT-shaped tail`],
            ["Layer expected loss estimate", "$" + (res.tradPremium / (1 + res.margin)).toFixed(2) + "M", "$" + res.elLayer.toFixed(2) + "M"],
            ["Loading", `Margin for adverse deviation ${(res.margin * 100).toFixed(0)}%`, "Expense & profit 15% + model-risk 10%"],
            ["Premium (USD M)", res.tradPremium.toFixed(2), res.synPremium.toFixed(2)],
            ["Rate on line", rol(res.tradPremium), rol(res.synPremium)],
            ["Quote instability (CV across re-samples)", (res.tradCV * 100).toFixed(0) + "%", (res.synCV * 100).toFixed(0) + "%"],
          ]} />
        <Note color={RUST}>
          With {hist} years of history the traditional quote is <span className="font-semibold">{Math.abs(diff).toFixed(0)}% {diff > 0 ? "higher" : "lower"}</span> than the synthetic-augmented price, and moves by about {(res.tradCV * 100).toFixed(0)}% each time the observed window changes. Lengthen the history or shorten the tail and the two converge — which is the paper's argument: synthetic data matters most where real data is thinnest.
        </Note>
      </div>
    </div>
  );
}

function ModelB() {
  return (
    <div>
      <PageHeader eyebrow="03 · Working model" title="Model B — Catastrophic event pricing" sub="A scenario generator for a single peril and a single excess-of-loss layer. It compares what an actuary can price from a short observed history with what the full synthetic distribution supports." />
      <Note color={RUST}><span className="font-semibold">Status: simulation.</span> Scenarios are drawn from a Poisson frequency and generalised-Pareto severity model, the Extreme Value Theory structure the paper uses to calibrate generated tails. The WGAN-GP / VAE generator described in the plan will replace the sampler here once its code is attached; the charts and pricing logic stay the same.</Note>
      <CatModel />
      <H2 color={RUST}>How this maps to the paper</H2>
      <P>Section H2 argues that small assumption errors in CAT models swing the PML by 25–50%, forcing large margins for adverse deviation. The "quote instability" row shows that effect directly: with few observed years, each re-sample of history produces a materially different premium. The synthetic set gives a stable tail, seeded — in the full design — by regional claims data, satellite hazard layers and analogue geographies such as Bangladesh flood experience for Bihar.</P>
    </div>
  );
}


/* -------------------- 04 · Competition, Financials & Roadmap -------------------- */

const POSITIONING = [
  { name: "Gift Re", x: 88, y: 88, self: true }, { name: "GIC Re", x: 22, y: 80 }, { name: "China Re", x: 30, y: 72 },
  { name: "Swiss Re", x: 85, y: 30 }, { name: "Munich Re", x: 80, y: 36 }, { name: "SCOR", x: 62, y: 28 },
  { name: "Hannover Re", x: 55, y: 32 }, { name: "Lloyd's", x: 58, y: 40 }, { name: "Berkshire Re", x: 45, y: 24 },
];
const ADOPTION = [
  ["Gift Re", 3, 3, 3, 3, 3], ["Swiss Re", 3, 3, 2, 1, 1], ["Munich Re", 3, 3, 2, 1, 0], ["SCOR", 2, 2, 1, 1, 0],
  ["Hannover Re", 2, 1, 1, 0, 0], ["Lloyd's", 2, 1, 1, 0, 0], ["Berkshire Hathaway Re", 1, 1, 1, 0, 0], ["GIC Re", 1, 0, 0, 0, 0],
];
const ADOPT_COLS = ["Underwriting", "Claims", "Cat / synthetic", "Float / investment", "Platform"];

function PositioningMap() {
  return (
    <svg viewBox="0 0 560 360" className="w-full" style={{ maxWidth: 640 }}>
      <rect x="60" y="20" width="230" height="150" fill={PANEL} />
      <rect x="290" y="20" width="230" height="150" fill="#F6EFDD" />
      <rect x="60" y="170" width="230" height="150" fill={PANEL} />
      <rect x="290" y="170" width="230" height="150" fill={PANEL} />
      <text x="70" y="38" fill="#777" fontSize="10" letterSpacing="2">LEGACY / REGIONAL</text>
      <text x="300" y="38" fill={GOLD} fontSize="10" letterSpacing="2">GIFT RE'S WHITE SPACE</text>
      <text x="70" y="188" fill="#777" fontSize="10" letterSpacing="2">UNDERDEVELOPED</text>
      <text x="300" y="188" fill="#777" fontSize="10" letterSpacing="2">GLOBAL LEADERS · THIN IN EM</text>
      {POSITIONING.map((p) => {
        const cx = 60 + p.x / 100 * 460, cy = 320 - p.y / 100 * 300;
        return (
          <g key={p.name}>
            <circle cx={cx} cy={cy} r={p.self ? 11 : 7} fill={p.self ? GOLD : INK} stroke={p.self ? INK : "none"} strokeWidth="2" />
            <text x={cx + 12} y={cy + 4} fill={INK} fontSize="11" fontWeight={p.self ? "bold" : "normal"}>{p.name}</text>
          </g>
        );
      })}
      <line x1="60" y1="320" x2="520" y2="320" stroke={INK} strokeWidth="1.5" />
      <line x1="60" y1="320" x2="60" y2="20" stroke={INK} strokeWidth="1.5" />
      <text x="290" y="340" textAnchor="middle" fill={INK} fontSize="11" letterSpacing="2">DIGITAL / AI MATURITY →</text>
      <text x="30" y="170" textAnchor="middle" fill={INK} fontSize="11" letterSpacing="2" transform="rotate(-90 30 170)">LOCAL / EM DEPTH →</text>
    </svg>
  );
}

function Part4({ go }) {
  const proj = [
    { y: "Year 1", "Gross premium": 56, Capital: 22, "Pre-tax profit": 3 },
    { y: "Year 2", "Gross premium": 139, Capital: 56, "Pre-tax profit": 12 },
    { y: "Year 3", "Gross premium": 278, Capital: 111, "Pre-tax profit": 26 },
  ];
  const layers = [
    ["01", "Output layer", "Management dashboards · Regulatory reports · APIs"],
    ["02", "Investment engine", "BiLSTM · TFT · Random Forest · Portfolio optimisation (Sharpe / Treynor)"],
    ["03", "Risk engine", "GAN / VAE / WGAN-GP · EVT calibration · Cat & cyber scenarios · Pricing APIs"],
    ["04", "Data layer", "Policy & claims · Market data · Satellite / geospatial · Sentiment · IIB · Alternative data"],
  ];
  const xcut = [["Encryption", "at rest and in transit"], ["Access", "role-based, least-privilege"], ["Audit", "every model decision logged"], ["Explainability", "hybrid ML → GLM pipelines"], ["Compliance", "IFSCA · IRDAI · GDPR"], ["Deployment", "containerised, Kubernetes"]];
  const mvp = [
    ["Year 1", "MVP 1.0", "Foundational capabilities", "Validate the investment engine", ["BiLSTM / TFT ensemble trained on NSE top-1,000", "20 years of factor-index data collected and analysed; backtests versus the factor indices", "Simple dashboards; internal use only"], INK],
    ["Year 2", "MVP 2.0", "Enhanced analytics & automation", "Add synthetic-data pricing", ["GAN / VAE pricing models for climate, cyber", "Satellite & geospatial data pipelines", "Pricing + underwriting integration; early client pilots"], TEAL],
    ["Year 3", "MVP 3.0", "Full-scale AI-driven reinsurer", "Scale and commercialise", ["Real-time ALM across asset & liability engines", "API integrations with brokers & cedants", "Expansion beyond India; target $300M+ premium"], GOLD],
  ];
  const [unit, setUnit] = useState("usd");
  return (
    <div>
      <PageHeader eyebrow="Part four" title="Competition, Financials & Roadmap" sub="Competitive landscape, financials, technology architecture and the MVP roadmap." />

      <H2 eyebrow="04 · Competitive landscape">Where Gift Re plays — positioning across AI maturity and emerging-market depth</H2>
      <div className="md:flex gap-6 items-start">
        <div className="md:w-3/5"><PositioningMap /></div>
        <DarkCard label="The positioning bet">
          <p className="mb-2">Global leaders have scale and digital maturity but remain thin in tier-3/4 India and wider emerging Asia.</p>
          <p className="mb-2">Regional players (GIC Re, China Re) have depth but lag on digitisation and specialty capacity.</p>
          <p>Gift Re is purpose-built for the empty top-right quadrant — AI-native and emerging-market-first.</p>
        </DarkCard>
      </div>

      <H2 eyebrow="04 · Competitive benchmarking">Benchmarking AI adoption — Gift Re vs global reinsurers</H2>
      <div className="overflow-x-auto border bg-white max-w-4xl" style={{ borderColor: LINE }}>
        <table className="w-full text-sm">
          <thead><tr style={{ background: INK, color: "white" }}><th className="px-3 py-2 text-left">Reinsurer</th>{ADOPT_COLS.map((c) => <th key={c} className="px-3 py-2 text-center font-medium">{c}</th>)}<th className="px-3 py-2 text-right">Score</th></tr></thead>
          <tbody>{ADOPTION.map((r, i) => (
            <tr key={r[0]} className="border-t" style={{ borderColor: LINE, background: i === 0 ? "#F6EFDD" : "white", fontWeight: i === 0 ? 700 : 400 }}>
              <td className="px-3 py-2">{r[0]}</td>
              {r.slice(1).map((v, j) => <td key={j} className="px-3 py-2 text-center"><span className="inline-block rounded-full" style={{ width: 14, height: 14, background: v === 3 ? GOLD : v === 2 ? INK : v === 1 ? "#B9C2CD" : "#EEE" }} /></td>)}
              <td className="px-3 py-2 text-right">{r.slice(1).reduce((a, b) => a + b, 0)}/15</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="text-xs text-gray-500 p-2">Gold = high adoption (3) · Navy = partial (2) · Grey = low (1) · blank = none</div>
      </div>
      <P>Incumbents have automated underwriting and claims — none have combined synthetic-data pricing with ML-driven float management. That intersection is Gift Re's white space.</P>

      <H2 eyebrow="04 · Differentiation">Gift Re's value proposition — four distinct advantages</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {[["Synthetic-data pricing", "GANs, VAEs and EVT-calibrated tails allow Gift Re to price the catastrophe, climate and cyber risks where competitors either decline or add punitive margins."],
          ["ML-driven float", "A BiLSTM ensemble trained and tested on 20 years of NSE data delivers alpha over Nifty 200 factor indices — converted directly into ROCE without extra underwriting risk."],
          ["AI-ready stack from day one", "No legacy mainframes to retrofit. Real-time ALM, automated data pipelines and containerised ML deployment."],
          ["India-first, then other emerging markets", "First-mover with expertise in tier-3/4 India; develop a blueprint portable to other emerging economies."]].map(([t, d]) => (
            <div key={t} className="bg-white border" style={{ borderColor: LINE }}>
              <div className="p-5"><div className="text-lg font-bold mb-1" style={{ fontFamily: SERIF, color: INK }}>{t}</div><div className="text-sm text-gray-700 leading-6">{d}</div></div>
              <div style={{ height: 10, background: GOLD }} />
            </div>
          ))}
      </div>

      <H2 eyebrow="04 · Unit economics">Unit economics — the two engines of a reinsurer</H2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[["$100", "Capital employed"], ["$300", "Premiums written"], ["$150", "Reinsurance float (~50% of premium)"], ["$250", "Total invested (capital + float)"], ["$15", "Investment income @ ~6%"], ["$30", "Total return (underwriting + investment)"]].map(([v, l]) => (
          <div key={l} className="p-3 text-center" style={{ background: PANEL }}><div className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>{v}</div><div className="text-xs text-gray-600 mt-1">{l}</div></div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border p-5" style={{ borderColor: LINE, borderLeft: `6px solid ${GOLD}` }}>
          <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Engine 1 · Underwriting margin</div>
          <div className="text-sm text-gray-700 leading-6">5% of premium at a 95% combined ratio = $15 on $100 capital → 15% ROCE from underwriting alone. This is the SP2 lever — synthetic data improves pricing precision and reduces loss ratios.</div>
        </div>
        <div className="bg-white border p-5" style={{ borderColor: LINE, borderLeft: `6px solid ${INK}` }}>
          <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Engine 2 · Investment income</div>
          <div className="text-sm text-gray-700 leading-6">$15 on $250 of assets at a 6% blended yield = another 15% ROCE on $100 capital. ML-based allocation and stock selection push yields above 6% without breaching solvency or liquidity rules.</div>
        </div>
      </div>

      <H2 eyebrow="04 · Financials">Financials of key reinsurers / competitors</H2>
      <Table caption="Annual financials — GIC Re and Munich Re (India) in ₹ Cr, Peak Re in USD M"
        head={["", "GIC Re (₹ Cr)", "Munich Re (₹ Cr)", "Peak Re (USD M)"]}
        rows={[["Gross premium", "33,576", "6,081", "1,556"], ["Commission", "6,247", "1,037", "—"], ["Claims", "30,980", "4,864", "1,367"], ["Investment income", "8,181", "506", "77"],
          ["Operational expense", "393", "221", "58"], ["Profit", "3,490", "465", "208"], ["Capital", "40,621", "2,060", "1,032"], ["Investment income on capital", "4,611", "125", "—"],
          ["Pre-tax profit", "8,101", "589", "208"], ["Tax", "1,381", "58", "7.5"], ["Post-tax profit", "6,497", "531", "200"], ["ROCE", "16%", "26%", "19%"]]} highlightLast />

      <H2 eyebrow="04 · Financials">Financial projections — marginal profits from the first year, scaling to $300M+ by Year 3</H2>
      <div className="md:flex gap-6">
        <div className="md:w-3/5 bg-white border p-3" style={{ borderColor: LINE }}>
          <div className="text-sm text-gray-600 mb-2">Gift Re · 3-year financial projection (USD M)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={proj} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Legend />
              <Bar dataKey="Gross premium" fill={INK}><LabelList position="top" style={{ fontSize: 11 }} /></Bar>
              <Bar dataKey="Capital" fill={GOLD}><LabelList position="top" style={{ fontSize: 11 }} /></Bar>
              <Bar dataKey="Pre-tax profit" fill={TEAL}><LabelList position="top" style={{ fontSize: 11 }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="md:w-2/5 grid grid-cols-2 gap-3">
          <BigStat value="14% → 23%" label="After-tax ROCE" sub="Year 1 to Year 3" dark />
          <BigStat value="~40%" label="Capital / premium" />
          <BigStat value="~50%" label="Float as % of premium" />
          <BigStat value="~95%" label="Target combined ratio" dark />
        </div>
      </div>
      <Table caption="Detailed P&L (₹ Cr) — premium at 2.5× capital, commission 10%, claims 85%, float income 4%, capital income 8%, MAT 9%"
        head={["₹ Cr", "Year 1", "Year 2", "Year 3"]}
        rows={[["Gross premium", "500", "1,250", "2,500"], ["Commission", "50", "125", "250"], ["Claims", "425", "1,063", "2,125"], ["Investment income – float", "20", "50", "100"],
          ["Operational expense", "30", "40", "50"], ["Profit from insurance", "15", "72.5", "175"], ["Capital", "200", "500", "1,000"], ["Investment income – capital", "16", "40", "80"],
          ["Overall pre-tax profit", "31", "112.5", "255"], ["MAT", "2.8", "10.1", "23"], ["Overall post-tax profit", "28.2", "102.4", "232.1"], ["ROCE", "14.1%", "20.5%", "23.2%"]]} highlightLast />
      <Note>The paper's USD pro-forma (Table 31: $60M → $301M gross premium) is in the Research paper section; the presentation's ₹ Cr build is shown here. Both use the same ratios.</Note>

      <H2 eyebrow="04 · Technology">Platform architecture — four layers, fully AI-native</H2>
      <div className="mb-4">
        {layers.map(([n, t, d], i) => (
          <div key={n} className="flex items-center gap-4 p-4 mb-2 text-white" style={{ background: i === 3 ? "#1E3A5F" : INK }}>
            <div className="text-2xl font-bold w-10" style={{ fontFamily: SERIF, color: GOLD }}>{n}</div>
            <div><div className="text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{t}</div><div className="text-sm" style={{ color: "#DCE3EC" }}>{d}</div></div>
          </div>
        ))}
      </div>
      <div className="p-4" style={{ background: PANEL }}>
        <div className="text-xs mb-3" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Cross-cutting · security & governance</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          {xcut.map(([a, b]) => <div key={a}><div className="font-bold" style={{ color: INK }}>{a}</div><div className="text-xs text-gray-600">{b}</div></div>)}
        </div>
      </div>

      <H2 eyebrow="04 · Roadmap">MVP roadmap — from investment engine to full-stack reinsurer</H2>
      <div className="grid md:grid-cols-3 gap-4">
        {mvp.map(([yr, v, sub, focus, items, col]) => (
          <div key={v} className="bg-white border" style={{ borderColor: LINE }}>
            <div className="p-5 text-white" style={{ background: col }}>
              <div className="text-xs" style={{ letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF, color: col === GOLD ? INK : GOLD }}>{yr}</div>
              <div className="text-3xl font-bold" style={{ fontFamily: SERIF, color: col === GOLD ? INK : "white" }}>{v}</div>
              <div className="text-sm italic" style={{ color: col === GOLD ? INK : "#DCE3EC" }}>{sub}</div>
            </div>
            <div className="p-5">
              <div className="text-xs mb-1" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Focus</div>
              <div className="font-bold mb-3" style={{ fontFamily: SERIF, color: INK }}>{focus}</div>
              <ul className="text-sm text-gray-700">{items.map((x) => <Bullet key={x}>{x}</Bullet>)}</ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- 05 · Team, Capital & SWOT -------------------- */

function Part5() {
  const team = [["Chief Actuary", "Pricing · Reserving · IRDAI liaison"], ["Chief Investment Officer", "Float strategy · ML model governance · Portfolio oversight"], ["Chief Risk Officer", "Solvency & RBC modelling · Stress testing"], ["Chief Technology Officer", "AI / ML engineering · Data platform · Security"], ["Head of Sales & Marketing", "Broker relationships · Cedant acquisition · B2B marketing"]];
  const rbc = [
    ["Capital formula", "Flat 150% of required capital, regardless of actual risk", "Scaled to the actual economic risk of each line"],
    ["Risk treatment", "Same capital charge for low- and high-risk books", "Capital released on low-risk lines, held on high-risk"],
    ["Rare events", "Handled by conservative margins for adverse deviation", "Modelled explicitly via stress tests and scenarios"],
    ["Asset allocation", "Mostly dictated by regulation and a preference for liquid instruments", "Flexible within solvency and liquidity bounds"],
    ["Minimum required", "₹200 crore to start; net worth of ₹1,000 crore must be demonstrated. Same for Gift Re registration.", "Minimums unchanged, but efficient allocation → lower capital → higher ROCE"],
  ];
  const swot = [
    ["Strengths", GREEN, ["Deep domain experience across actuarial, investment, technology and sales", "Proven MVP on the investment engine — backtested and benchmarked", "GIFT City regulatory environment purpose-built for reinsurance", "AI-native stack — no legacy systems to migrate"]],
    ["Weaknesses", RED, ["New entrant — no credit rating at launch", "Limited capital vs global incumbents", "Brand recognition must be earned from zero", "Small team — key-person risk until scale is reached"]],
    ["Opportunities", TEAL, ["USD 700B global market growing at 10–11% CAGR", "Tier-3/4 India almost completely underserved by foreign reinsurers", "RBC migration rewards sophisticated modelling", "Cross-border reinsurance from GIFT City opens multiple geographies"]],
    ["Threats", "#A8893B", ["GIC Re mandatory cession limits domestic treaty volume", "Regulators may resist synthetic-data-only justifications", "AI talent scarcity and high compensation pressure", "Algorithmic-monoculture risk if many reinsurers adopt similar ML"]],
  ];
  return (
    <div>
      <PageHeader eyebrow="Part five" title="Team, Capital & SWOT" sub="Team structure, Risk-Based Capital and SWOT analysis." />
      <H2 eyebrow="05 · Team">A lean team with cross-disciplinary depth</H2>
      <div className="flex justify-center mb-2"><div className="text-white px-8 py-3 font-bold" style={{ background: INK, fontFamily: SERIF }}>CEO / Managing Director</div></div>
      <div className="flex justify-center"><div style={{ width: 2, height: 20, background: "#999" }} /></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {team.map(([t, d]) => (
          <div key={t} className="bg-white border text-center" style={{ borderColor: LINE }}>
            <div style={{ height: 10, background: GOLD }} />
            <div className="p-4"><div className="font-bold text-base mb-2" style={{ fontFamily: SERIF, color: INK }}>{t}</div><div className="mx-auto mb-2" style={{ width: 36, height: 2, background: GOLD }} /><div className="text-xs text-gray-600 leading-5">{d}</div></div>
          </div>
        ))}
      </div>

      <H2 eyebrow="05 · Regulatory">Risk-Based Capital — the regime Gift Re is purpose-built for</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {[["Rule-based (current)", "#7C8898", 1], ["Risk-based (emerging)", INK, 2]].map(([t, col, idx]) => (
          <div key={t} className="bg-white border" style={{ borderColor: LINE }}>
            <div className="p-4 text-white font-bold" style={{ background: col, fontFamily: SERIF, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 13 }}>{t}</div>
            {rbc.map((r) => (
              <div key={r[0]} className="px-5 py-3 border-t md:flex gap-4 text-sm" style={{ borderColor: LINE }}>
                <div className="md:w-1/3 text-xs pt-1" style={{ color: GOLD, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: SERIF }}>{r[0]}</div>
                <div className="md:w-2/3 text-gray-700">{r[idx]}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <H2 eyebrow="05 · Company SWOT">SWOT — what we bring, and where we have to be honest</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {swot.map(([t, col, items]) => (
          <div key={t} className="bg-white border" style={{ borderColor: LINE }}>
            <div className="p-3 text-white font-bold" style={{ background: col, fontFamily: SERIF, letterSpacing: "0.25em", textTransform: "uppercase", fontSize: 14 }}>{t}</div>
            <ul className="p-5 text-sm text-gray-700">{items.map((x) => <Bullet key={x} color={col}>{x}</Bullet>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- 06 · Business Impact & Key Takeaways -------------------- */

function Part6({ go }) {
  const risks = [
    ["Regulator resists synthetic-data-only capital relief", "Always present synthetic data alongside real experience; use hybrid ML → GLM architectures that actuaries can audit end-to-end."],
    ["GAN outputs on genuinely novel risks are unreliable", "Restrict synthetic data to rare-but-known perils; flag model confidence explicitly to underwriters and price with conservative loadings for unknowns."],
    ["ML portfolio underperforms in a regime shift", "Quarterly retraining plus a human investment-committee override; backtest across multiple regimes (GFC, COVID) in the dissertation."],
    ["Government / regulator (IRDAI, IFSCA) support may reduce as the framework evolves", "GIFT City is gaining prominence with regulatory support; Gift Re will maintain active dialogue with the IFSCA team and its working groups to sustain momentum."],
  ];
  const takeaways = [
    ["Underserved market", "Global reinsurance is a USD 700B market growing at 10–11%; India at ~15%. Tier-3/4 India is almost unserved by foreign reinsurers."],
    ["Two solution propositions", "SP1: ML-driven float management generates superior risk-adjusted returns on reinsurance capital. SP2: GAN/VAE synthetic data improves pricing of rare catastrophe risks. Both validated through backtests and expert discovery."],
    ["Customer discovery & validation", "21 senior industry interviews confirmed both pain points. SP1 is backtested on 20 years of NSE data. SP2 is grounded in EVT theory and expert validation — the GAN/VAE pricing pilot is the next research phase."],
    ["Good results from the backtests", "The BiLSTM portfolio shows alpha over Nifty 200 factor indices — the investment engine is operational."],
    ["Commercially viable", "Financial projections show 14% → 23% after-tax ROCE by Year 3 with $300M+ gross premium."],
  ];
  return (
    <div>
      <PageHeader eyebrow="Part six" title="Business Impact & Key Takeaways" sub="Business impact and research contribution, risks and mitigation, and key takeaways." />
      <H2 eyebrow="06 · Contribution">Business impact & research contribution</H2>
      <div className="grid md:grid-cols-2 gap-4">
        {[["Academic", "Theoretical & empirical contributions", ["Integrated framework combining EVT + GAN/VAE for reinsurance pricing in a data-scarce emerging market", "Empirical evidence on ML-driven float management — BiLSTM / TFT vs factor-investing benchmarks in Indian equities", "Conceptual model linking asset-side and liability-side AI within a single reinsurer balance sheet", "Explainability — where ML is (and is not) acceptable to actuaries and regulators"]],
          ["Practitioner", "Operational & strategic contributions", ["A blueprint for an AI-enabled reinsurer — architecture, team, economics and 3-year financial model", "A working MVP and open-source benchmark methodology for backtesting ML portfolios on Indian equities", "A reference implementation of synthetic-data pricing calibrated against EVT tails and useful to regulators", "A documented roadmap for closing the protection gap in tier-3/4 India via alternative-data underwriting"]]].map(([l, t, items]) => (
            <div key={l} className="bg-white border" style={{ borderColor: LINE }}>
              <div className="p-4 text-white" style={{ background: INK }}><div className="text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{l}</div><div className="text-lg font-bold" style={{ fontFamily: SERIF }}>{t}</div></div>
              <ul className="p-5 text-sm text-gray-700">{items.map((x) => <li key={x} className="flex gap-3 mb-3"><span className="font-bold" style={{ color: GOLD }}>→</span><span>{x}</span></li>)}</ul>
            </div>
          ))}
      </div>

      <H2 eyebrow="06 · Risks">Risks to the research and business venture — with mitigations</H2>
      <div className="hidden md:grid grid-cols-2 gap-4 text-xs mb-1 px-4" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}><div>Risk</div><div>Mitigation</div></div>
      {risks.map(([r, m], i) => (
        <div key={r} className="md:grid grid-cols-2 gap-4 border p-4 mb-2 text-sm" style={{ borderColor: LINE, background: i % 2 ? PANEL : "white" }}>
          <div className="font-bold flex gap-3" style={{ fontFamily: SERIF, color: INK }}><span style={{ color: RED }}>▲</span>{r}</div>
          <div className="text-gray-700 flex gap-3 mt-2 md:mt-0"><span style={{ color: GREEN }}>●</span>{m}</div>
        </div>
      ))}

      <H2 eyebrow="06 · Closing">Key takeaways</H2>
      <div className="grid md:grid-cols-3 gap-4">
        {takeaways.map(([t, d], i) => (
          <div key={t} className="bg-white border p-5" style={{ borderColor: LINE }}>
            <div className="flex gap-4 items-center mb-3"><Circle n={i + 1} /><div className="font-bold text-base" style={{ fontFamily: SERIF, color: INK }}>{t}</div></div>
            <div className="text-sm text-gray-700 leading-6">{d}</div>
          </div>
        ))}
        <div className="p-5 text-white flex flex-col justify-center" style={{ background: INK }}>
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: SERIF }}>Thank you</div>
          <div className="text-sm" style={{ color: "#DCE3EC" }}>Questions, critique and guidance welcome.</div>
          <div className="text-xs mt-4" style={{ color: GOLD }}>Abhay Tewari · DBA in Emerging Technologies · Golden Gate University · Cohort 6894 · Chair: Dr. Siwar Jendoubi</div>
        </div>
      </div>
    </div>
  );
}


/* -------------------- About the researcher -------------------- */

function AboutResearcher() {
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };
  return (
    <div>
      <PageHeader eyebrow="Evidence base · About the researcher" title="28+ years at the intersection of Actuarial Science, Investment and AI"
        sub="Abhay Tewari · MD & CEO, Star Union Dai-ichi Life Insurance · FIA (UK) · FIAI · CFA" />
      <div style={grid} className="mb-6">
        <div className="p-5" style={{ background: PANEL, borderTop: `5px solid ${GOLD}` }}>
          <div className="text-xs mb-3" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Career</div>
          {[["MD & CEO, SUD Life", "2021 – present · Revenue CAGR >25%"], ["Chief Actuary, SUD Life", "2014 – 2021"], ["Appointed Actuary, Edelweiss Life", "2010 – 2014"], ["Dy. Chief Actuary, SBI Life", "Earlier career · SEBI, Surveillance & Investigation"]].map(([a, b]) => (
            <div key={a} className="mb-3"><div className="font-semibold text-sm" style={{ color: INK }}>{a}</div><div className="text-xs text-gray-600">{b}</div></div>
          ))}
        </div>
        <div className="p-5" style={{ background: PANEL, borderTop: `5px solid ${GOLD}` }}>
          <div className="text-xs mb-3" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>Education</div>
          {[["PGP AIML – University of Texas", "AIML models and application"], ["IIT Kanpur", "E-Masters in Economics, Finance and Public Policy"], ["FIA · Institute & Faculty of Actuaries (UK)", ""], ["FIAI · Institute of Actuaries of India", ""], ["CFA Charter · CFA Institute (USA)", ""]].map(([a, b]) => (
            <div key={a} className="mb-3"><div className="font-semibold text-sm" style={{ color: INK }}>{a}</div>{b && <div className="text-xs text-gray-600">{b}</div>}</div>
          ))}
        </div>
        <DarkCard label="Research & ventures">
          {[["Gift Re", "AI-enabled reinsurer · GIFT City"], ["GanitagyAI", "Actuarial software · IFRS 17 / IndAS 117"], ["AIF Platform", "Cat 1 & Cat 3 funds · InsurTech / AI"]].map(([a, b]) => (
            <div key={a} className="mb-3"><div className="font-semibold text-white">{a}</div><div className="text-xs">{b}</div></div>
          ))}
        </DarkCard>
      </div>
      <H2 eyebrow="The programme">Doctoral research</H2>
      <div style={grid}>
        <Card title="Programme" bar={false}>Doctor of Business Administration in Emerging Technologies, Golden Gate University, Cohort 6894. Chair: Dr. Siwar Jendoubi. Research proposal presented May 2026; final submission 2 September 2026.</Card>
        <Card title="Research question" bar={false}>Whether ML-driven investment management can generate superior risk-adjusted returns on reinsurance float, and whether generative models (GANs/VAEs) can meaningfully improve catastrophe risk pricing in data-scarce markets.</Card>
        <Card title="Why this researcher" bar={false}>Chief Actuary and Appointed Actuary roles across three life insurers, a CEO's view of float and capital, an AIML credential and a CFA charter — the asset side and the liability side of the same balance sheet, which is the thesis of Gift Re.</Card>
      </div>
    </div>
  );
}

/* -------------------- Documents -------------------- */

function Documents() {
  return (
    <div>
      <PageHeader eyebrow="Evidence base" title="Documents" sub="Everything the committee may need to read alongside the portal." />
      <div className="max-w-4xl">
        {DOCS.map((d, i) => (
          <div key={d.name} className="border-b px-4 py-3 md:flex gap-4 items-baseline" style={{ borderColor: LINE, background: i % 2 ? PANEL : "white" }}>
            <div className="flex-1"><div className="font-semibold" style={{ color: INK }}>{d.name}</div><div className="text-sm text-gray-600">{d.type}</div></div>
            {d.href
              ? <a href={d.href} className="text-sm mt-1 md:mt-0 font-semibold underline" style={{ color: GREEN }}>{d.status}</a>
              : <div className="text-sm mt-1 md:mt-0 font-semibold" style={{ color: d.status.startsWith("In the") ? GREEN : "#A8893B" }}>{d.status}</div>}
          </div>
        ))}
      </div>
      <Note>Downloads open the files in the repository's docs folder. Items marked "to be uploaded" will be linked here once shared.</Note>
    </div>
  );
}

/* -------------------- App shell -------------------- */

export default function GiftRePortal() {
  const [page, setPage] = useState("p1");
  const [menu, setMenu] = useState(false);
  const go = (id) => { setPage(id); setMenu(false); if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0); };
  const pages = { p1: Part1, p2: Part2, p3: Part3, "model-a": ModelA, "wm-models": WMModels, "wm-process": WMProcess, "wm-outputs": WMOutputs,
    "wm-spec": WMSpec, "wm-outputs-check": WMCheckOutputs, "model-b": ModelB, p4: Part4, p5: Part5, p6: Part6, paper: Paper, interviews: Interviews, insights: Insights, documents: Documents, about: AboutResearcher };
  const Page = pages[page];
  const idx = NAV.findIndex((n) => n.id === page);
  let lastGroup = null;
  return (
    <div className="min-h-screen md:flex" style={{ background: PAPER, fontFamily: SANS, color: INK }}>
      <aside className="md:w-64 flex-shrink-0 text-white md:min-h-screen" style={{ background: INK }}>
        <div className="p-5 flex justify-between items-center" style={{ borderBottom: `1px solid ${GOLD}55` }}>
          <button onClick={() => go("p1")} className="text-left">
            <div className="text-2xl font-bold" style={{ fontFamily: SERIF, letterSpacing: "0.15em" }}>GIFT RE</div>
            <div className="text-xs mt-1" style={{ color: GOLD, letterSpacing: "0.15em" }}>DBA RESEARCH PORTAL · GGU 6894</div>
          </button>
          <button className="md:hidden text-sm border px-2 py-1" style={{ borderColor: GOLD, color: GOLD }} onClick={() => setMenu(!menu)}>{menu ? "Close" : "Menu"}</button>
        </div>
        <nav className={(menu ? "block" : "hidden") + " md:block py-3"}>
          {NAV.map((n) => {
            const groupHeader = n.group && n.group !== lastGroup ? n.group : null; lastGroup = n.group || lastGroup;
            return (
              <div key={n.id}>
                {groupHeader && <div className="px-5 pt-4 pb-1 text-xs" style={{ color: GOLD, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: SERIF }}>{groupHeader}</div>}
                <button onClick={() => go(n.id)}
                  className={"block w-full text-left py-2 text-sm " + (n.sub2 ? "pl-16 pr-5" : n.sub ? "pl-12 pr-5" : "px-5") + (page === n.id ? "" : " hover:text-white")}
                  style={{ borderLeft: `4px solid ${page === n.id ? GOLD : "transparent"}`, color: page === n.id ? "white" : "#B9C2CD", background: page === n.id ? "rgba(255,255,255,0.06)" : "transparent" }}>
                  {n.num && <span className="mr-3" style={{ color: GOLD, fontFamily: SERIF }}>{n.num}</span>}{n.label}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="hidden md:block px-5 pt-6 text-xs" style={{ color: "#8A97A8" }}>Abhay Tewari · Chair: Dr. Siwar Jendoubi · May 2026</div>
      </aside>
      <main className="flex-1 min-w-0 px-5 md:px-12 py-8">
        <Page go={go} />
        <div className="flex justify-between mt-14 pt-4 text-sm" style={{ borderTop: `1px solid ${LINE}` }}>
          {idx > 0 ? <button className="underline" style={{ color: INK }} onClick={() => go(NAV[idx - 1].id)}>← {NAV[idx - 1].label}</button> : <span />}
          <span className="text-xs" style={{ color: GOLD, letterSpacing: "0.2em" }}>GIFT RE</span>
          {idx < NAV.length - 1 ? <button className="underline" style={{ color: INK }} onClick={() => go(NAV[idx + 1].id)}>{NAV[idx + 1].label} →</button> : <span />}
        </div>
      </main>
    </div>
  );
}
