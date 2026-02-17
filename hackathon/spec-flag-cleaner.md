# Feature Flag Graveyard Cleaner — Detailed Spec

**Project Name:** The Flag Graveyard

**Description:** A Python tool that scans sentry, getsentry, and sentry-options-automator to find dead, stale, and misconfigured feature flags. Uses the actual sentry feature registry (no regex!) and existing flagpole parsing code. Produces a markdown report, identifies owners, and optionally notifies teams to clean up their flags.

## Architecture

```
hackathon/flag-cleaner/
├── scan.py              # Main entry point / CLI
├── parsers.py           # Extract flag registrations from source files
├── searchers.py         # Find flag usage across repos
├── analyzers.py         # Classify flags (dead, stale, GA, etc.)
├── reporters.py         # Generate markdown report
└── report.md            # Output (gitignored)
```

Single script (`scan.py`) is fine for the hackathon — the module split above is logical structure within that file, not necessarily separate files.

## Data Model

```python
@dataclass
class FlagRegistration:
    name: str                    # "organizations:gen-ai-features"
    source_type: str             # "temporary" | "permanent" | "getsentry"
    feature_class: str           # "OrganizationFeature" | "ProjectFeature" | "SystemFeature"
    handler_strategy: str        # "FLAGPOLE" | "INTERNAL"
    api_expose: bool
    default: bool

@dataclass
class FlagUsage:
    file: str                    # relative path
    repo: str                    # "sentry" | "getsentry" | "sentry-options-automator"
    line: int
    context: str                 # trimmed line content
    usage_type: str              # "code" | "test" | "frontend" | "plan-list" | "early-adopter" | "handler" | "flagpole-config" | "tenant-whitelist"

@dataclass
class FlagpoleConfig:
    enabled: bool
    created_at: str              # ISO date
    owner_team: str
    owner_email: str
    segments: list[dict]         # raw segment data
    is_ga: bool                  # True if any segment has rollout=100 + empty conditions
    rollout_summary: str         # e.g. "GA (100% unconditional)" or "3 orgs + sentry internal"

@dataclass
class FlagReport:
    registration: FlagRegistration
    usages: list[FlagUsage]
    flagpole: FlagpoleConfig | None
    in_plan_lists: list[str]     # e.g. ["AM2_TEAM", "AM3_BUSINESS"]
    owner: str                   # from flagpole > CODEOWNERS > git blame
    last_code_change: date | None
    last_flagpole_change: date | None
    status: str                  # classification result
```

## Step-by-Step Implementation

### Step 1: Enumerate registered flags from the sentry feature registry

**No regex needed.** The script runs within the sentry repo and can import the feature manager directly:

```python
from sentry import features
from sentry.features.base import OrganizationFeature, ProjectFeature, SystemFeature
from django.conf import settings

manager = features.default_manager

for name, feature_class in manager.all().items():
    registration = FlagRegistration(
        name=name,
        source_type="permanent" if ...,  # determine from which file registered it
        feature_class=feature_class.__name__,
        handler_strategy="FLAGPOLE" if name in manager.flagpole_features else "INTERNAL",
        api_expose=name in manager.exposed_features,
        default=settings.SENTRY_FEATURES.get(name, False),
    )
```

Key manager APIs:

- `manager.all()` → `dict[str, type[Feature]]` — all registered features
- `manager.all(feature_type=OrganizationFeature)` → filter by scope
- `manager.flagpole_features` → `set[str]` — features managed by Flagpole
- `manager.exposed_features` → `set[str]` — API-exposed features
- `settings.SENTRY_FEATURES[name]` → default value

This gives us ~300 temporary + ~40 permanent features in one shot.

**For getsentry features** (~30 flags): these are registered at import time via `getsentry/features.py`. If we can import getsentry, they'll be in the same manager. Otherwise, fall back to grep on `features.add(` / `manager.add(` in that file.

**Note:** The script needs to run with Django initialized. Use `sentry.runner.initializer` or run via `sentry exec hackathon/flag-cleaner/scan.py`.

### Step 2: Parse flagpole.yaml

**Reuse existing code.** Sentry already has a flagpole parser at `src/flagpole/__init__.py`:

```python
from flagpole import Feature as FlagpoleFeature

# Parse all features from the YAML file
with open(flagpole_yaml_path) as f:
    yaml_content = f.read()

flagpole_features = FlagpoleFeature.from_bulk_yaml(yaml_content)

for fp_feature in flagpole_features:
    # fp_feature.name = "feature.organizations:flag-name"
    # fp_feature.owner = OwnerInfo(team=..., email=...)
    # fp_feature.enabled = True/False
    # fp_feature.segments = [Segment(...), ...]
    # fp_feature.created_at = "2024-06-07"
    canonical_name = fp_feature.name.removeprefix("feature.")
```

The existing `Feature.from_bulk_yaml()` handles all YAML parsing, segment extraction, and owner info. No custom parsing needed.

**For validation**, sentry-options-automator has a JSON schema at `python/src/flagpole/flagpole_file_schema.json` and a validator at `python/src/flagpole/validate.py`.

**GA detection:** Check if any segment has `rollout == 100` and empty `conditions`:

```python
def is_ga(fp_feature: FlagpoleFeature) -> bool:
    return any(
        segment.percentage == 100 and not segment.conditions
        for segment in fp_feature.segments
    )
```

**From `sentry-options-automator/options/regions/*/app.yaml`:**

- Look for `flagpole.allowed_features` key in each region file
- These are single-tenant whitelists (disney, geico, goldmansachs, ly)
- A flag in a whitelist is "in use" for that tenant

### Step 3: Search for backend code usage

Use `grep -rn` across repos. For each registered flag name, search these locations:

| Repo      | Directories                          | File types | Exclude                       |
| --------- | ------------------------------------ | ---------- | ----------------------------- |
| sentry    | `src/sentry/`, `src/sentry_plugins/` | `*.py`     | `migrations/`, `__pycache__/` |
| sentry    | `tests/`                             | `*.py`     | `__pycache__/`                |
| getsentry | `getsentry/`                         | `*.py`     | `migrations/`, `__pycache__/` |
| getsentry | `tests/`                             | `*.py`     | `__pycache__/`                |

**Important:** Skip the registration files themselves (temporary.py, permanent.py, getsentry/features.py) — those are registrations, not usage.

Classify each hit:

- File starts with `tests/` → `usage_type = "test"`
- Otherwise → `usage_type = "code"`

### Step 4: Search for frontend usage

Frontend flag checks are **more complex** than backend. The frontend uses `descopeFeatureName()` (`static/app/utils.tsx`) which strips `organizations:` and `projects:` prefixes. So flags appear in THREE forms:

1. **With prefix**: `organization.features.includes('organizations:dashboards-edit')`
2. **Without prefix** (most common): `organization.features.includes('dashboards-edit')`
3. **In Feature component**: `<Feature features="organizations:dashboards-edit">` or `<Feature features="dashboards-edit">`

**Search strategy:** For flag `"organizations:crash-rate-alerts"`, search `static/` for BOTH:

- The full name: `"organizations:crash-rate-alerts"`
- The short name: `"crash-rate-alerts"`

Searching for the short name alone should cover all cases, but searching both prevents false positives from unrelated strings that happen to match.

File types: `*.ts`, `*.tsx`, `*.js` (exclude `node_modules/`)

All frontend hits → `usage_type = "frontend"`

### Step 5: Search plan feature lists in getsentry

These use **short names** (without `organizations:` prefix):

```python
# getsentry/billing/plans/am2/features.py
AM2_TEAM_FEATURES = AM2_FREE_FEATURES[:] + [
    "codecov-integration",     # short name!
    "crash-rate-alerts",
    ...
]
```

So for flag `"organizations:crash-rate-alerts"`, search for `"crash-rate-alerts"` in:

- `getsentry/billing/plans/am1/features.py`
- `getsentry/billing/plans/am2/features.py`
- `getsentry/billing/plans/am3/features.py`
- `getsentry/billing/plans/features.py` (DATA_CATEGORY_FEATURE_MAP)

If found → `usage_type = "plan-list"`, record which list (AM2_FREE, AM3_BUSINESS, etc.)

### Step 6: Search early adopters and handlers

In `getsentry/features.py`:

- Search for flag name in `FEATURE_EARLY_ADOPTERS` dict → `usage_type = "early-adopter"`
- Search for flag name in handler class `features` attributes → `usage_type = "handler"`

### Step 7: Git staleness analysis

For each flag, determine last modification date:

```bash
# Last change to any usage site (sample up to 5 for performance)
git -C /path/to/sentry log -1 --format=%cI -- path/to/usage/file.py
```

For flagpole.yaml staleness:

```bash
# Use git log -S to find last commit that touched this flag name
git -C /path/to/sentry-options-automator log -1 --format=%cI -S "feature.organizations:flag-name" -- options/default/flagpole.yaml
```

**Performance note:** Git log per-flag is slow for 300+ flags. Options:

1. Run in parallel (subprocess pool)
2. Cache: run `git log --all --format='%H %cI' -- file` once per file, then map
3. Skip with `--skip-git` flag for quick iteration

### Step 8: Determine ownership

Priority order:

1. `flagpole.yaml` → `owner.team` + `owner.email` (most authoritative)
2. `.github/CODEOWNERS` → match usage file paths against rules
3. `git blame` → last modifier of the registration line (fallback)

### Step 9: Classify each flag

```python
def classify(flag: FlagReport) -> str:
    code_usages = [u for u in flag.usages if u.usage_type == "code"]
    test_usages = [u for u in flag.usages if u.usage_type == "test"]
    frontend_usages = [u for u in flag.usages if u.usage_type == "frontend"]
    plan_usages = [u for u in flag.usages if u.usage_type == "plan-list"]

    has_code = bool(code_usages or frontend_usages)
    has_tests_only = bool(test_usages) and not has_code
    has_plan = bool(plan_usages)
    has_flagpole = flag.flagpole is not None

    # Flagpole disabled globally
    if has_flagpole and not flag.flagpole.enabled:
        return "flagpole-disabled"

    # No usage anywhere
    if not flag.usages and not has_flagpole:
        return "dead"

    # Only in tests
    if has_tests_only and not has_plan and not has_flagpole:
        return "dead-except-tests"

    # In flagpole but no code references
    if has_flagpole and not has_code and not has_tests_only:
        return "flagpole-configured-but-unused"

    # In plan lists but not in code
    if has_plan and not has_code:
        return "plan-bound-only"

    # GA everywhere (unconditional rollout) — candidate to graduate or delete
    if has_flagpole and flag.flagpole.is_ga and has_code:
        return "ga-ready-to-graduate"

    # Permanent flag still checked conditionally
    if flag.registration.source_type == "permanent" and has_code:
        return "graduated-remnant"

    # Stale check
    cutoff = date.today() - timedelta(days=180)
    if flag.last_code_change and flag.last_code_change < cutoff:
        if not flag.last_flagpole_change or flag.last_flagpole_change < cutoff:
            return "stale"

    return "active"
```

### Step 10: Generate report

Markdown report with sections:

```markdown
# Feature Flag Graveyard Report

Generated: 2026-02-17

## Summary

| Status                         | Count | Action                                                 |
| ------------------------------ | ----- | ------------------------------------------------------ |
| Dead                           | N     | Safe to remove registration + all references           |
| Dead (test-only)               | N     | Likely safe to remove                                  |
| Flagpole-disabled              | N     | Safe to remove (already off)                           |
| GA-ready-to-graduate           | N     | Graduate to permanent.py or delete flag + conditionals |
| Flagpole-configured-but-unused | N     | Config drift — remove from flagpole.yaml               |
| Stale                          | N     | Review for graduation or removal                       |
| Plan-bound-only                | N     | Manual review (billing-critical)                       |
| Graduated-remnant              | N     | Simplify code (remove conditional)                     |
| Active                         | N     | No action                                              |

## Dead Flags (safe to remove)

[table with flag name, type, source, owner]

## GA-Ready-to-Graduate Flags

[table with flag name, flagpole created_at, owner, rollout summary]
Action: either move to permanent.py (if feature should stay forever) or delete the flag and remove all conditionals (if feature is just "done")

...etc for each category
```

## CLI Interface

```bash
# Full scan (slow — includes git analysis)
sentry exec hackathon/flag-cleaner/scan.py

# Quick scan (no git, no staleness data)
sentry exec hackathon/flag-cleaner/scan.py --skip-git

# Custom staleness threshold
sentry exec hackathon/flag-cleaner/scan.py --staleness-days 90

# Custom output path
sentry exec hackathon/flag-cleaner/scan.py --output /tmp/flag-report.md

# Only show dead flags (quick check)
sentry exec hackathon/flag-cleaner/scan.py --skip-git --only dead

# Custom repo paths (if not in standard locations)
sentry exec hackathon/flag-cleaner/scan.py \
  --getsentry-path /path/to/getsentry \
  --automator-path /path/to/sentry-options-automator
```

Note: uses `sentry exec` to run within Django context so we can import the feature manager.

## Performance Considerations

- Step 1 (registry enumeration) is instant — just a dict read
- Step 2 (flagpole parsing) is fast — existing parser + one YAML load
- Steps 3-6 (grep) are the main cost: ~300 flags × grep across 3 repos
- Optimization: batch all flag names into a single grep with `-E "flag1|flag2|flag3"` pattern, then distribute results
- Git log is the other bottleneck — `--skip-git` makes the scan ~10x faster
- For git staleness: use `git log -S "flag-name"` once per flag rather than per-line blame

## Edge Cases

- **Frontend name stripping**: Frontend uses `descopeFeatureName()` which strips `organizations:` / `projects:` prefixes. Search for both the full name and short name in frontend files.
- **Plan list short names**: getsentry plan lists use short names (e.g. `"crash-rate-alerts"` not `"organizations:crash-rate-alerts"`). Strip prefix when searching plan files.
- **Flagpole key format**: flagpole.yaml uses `"feature.organizations:flag-name"` — strip `"feature."` prefix when matching against the registry.
- **`default=True` flags**: Some temporary flags have `default=True` — these are effectively always-on but still registered as temporary.
- **FEATURE_EARLY_ADOPTERS**: Hardcoded org ID lists — these flags are "active" even if not in plan lists.
- **FLAGPOLE strategy**: Flags with `FeatureHandlerStrategy.FLAGPOLE` are remotely configured — a flag with zero code references but live segments in flagpole.yaml is NOT dead.
- **`enabled: false` in flagpole**: Globally disabled — strong removal candidate if also unused in code.
- **Unconditional GA segment**: `rollout: 100` + `conditions: []` means on for everyone — graduate or delete.
- **Single-tenant whitelists**: `flagpole.allowed_features` in region YAML files gate which flags are evaluated per tenant.

## Stretch Goals

1. **Cleanup PR generator**: For dead flags, generate a branch that removes the registration + all usage sites
2. **Flagpole.yaml cleanup**: For flagpole-configured-but-unused, generate a PR to sentry-options-automator removing the stale config
3. **Graduation helper**: For GA-ready flags, either move to permanent.py or delete the flag entirely and remove all conditionals
4. **Scheduled CI job**: Run weekly, post report to Slack channel
5. **Interactive mode**: After scan, prompt "Remove flag X? [y/n]" and auto-generate the diff
6. **Team notification**: For non-active flags, detect who added them, which team they're on, and message that team to look into the flag

   **How to find the author:**
   - `git log --diff-filter=A --format='%ae %an' -S "flag-name" -- src/sentry/features/temporary.py` → who added the registration line
   - Cross-reference with flagpole.yaml `owner.team` / `owner.email` if available (more current than git blame)

   **How to find their team:**
   - Priority: flagpole.yaml `owner.team` > `.github/CODEOWNERS` path match > Sentry org chart / GitHub teams API
   - Could also use `gh api orgs/getsentry/teams` + member lookups if we have a GH token

   **How to notify:**
   - Slack: use Slack API (`chat.postMessage`) to DM or post to team channel (team name → `#team-{name}` convention)
   - Message template: "Hey {team}, the feature flag `{flag-name}` was classified as **{status}** by the flag cleaner. It was added by {author} on {date}. Could someone look into cleaning it up? [Report link]"
   - Batch by team: group all flags per team into a single message to avoid spam
   - Dry-run mode (`--notify --dry-run`): print what would be sent without actually messaging
