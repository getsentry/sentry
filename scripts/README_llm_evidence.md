# LLM Issue Evidence Extractor

We need to analyze the fields and values the LLM is returning. Do this by pulling a list of llm-created issues from redash,
get all events on each issue, then query eventstore to get the full event details, which has
the fields we are interested in (hidden in evidence_data). Extract those fields,
output as csv to use in data-analysis scripts.

## Setup

```bash
export SENTRY_AUTH_TOKEN="your_token_here"
```

Get token from [Account Settings > API Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/) (stored in 1Password as "sentry api token")

## Usage

1. Adjust date and run [Nora LLM Detected Issues](https://redash.getsentry.net/queries/9889/source)
2. Export to CSV (must include `issue_id` column)
3. Run:

```bash
./scripts/run_extractor.sh ~/Downloads/your_redash_export.csv
```

Output: `~/Desktop/llm_evidence_YYYYMMDD_HHMMSS.csv`

## Output Fields

LLM-generated fields from `DetectedIssue`:

- `title` - Issue title
- `explanation` - Analysis
- `impact` - Impact description
- `evidence` - Supporting evidence
- `missing_telemetry` - Missing telemetry notes

Plus `issue_id` to find the issue in Sentry UI.
