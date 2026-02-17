# AI Codeathon Implementation Plan

## Context

3-day AI codeathon (Feb 17-19). Two projects:

1. **Quick win (Day 1)**: Feature Flag Graveyard Cleaner — scan for orphaned flags, generate cleanup report + PRs
2. **Main project (Days 1-3)**: Auto Demo Generator — generates demo videos from natural language descriptions

The quick win gives us something real to ship AND something to point the demo generator at ("here, demo the flag cleaner").

### Detailed Specs

- **Flag Cleaner**: [`hackathon/spec-flag-cleaner.md`](spec-flag-cleaner.md) — data model, 9-step implementation, classification logic, CLI interface
- **Demo Generator**: [`hackathon/spec-demo-generator.md`](spec-demo-generator.md) — 6-stage pipeline, LLM prompt strategy, ElevenLabs + FFmpeg integration

---

## Step 0: Create project ideas doc in sentry repo

Create a markdown file at a visible location (e.g., `hackathon/codeathon-2026-projects.md`) with all 8 project ideas for others to see and get inspired by. This is just the ideas list from our brainstorming.

---

## Project A: Feature Flag Graveyard Cleaner (Day 1)

### Goal

Scan **both sentry and getsentry** codebases to find orphaned/stale feature flags, generate a report and cleanup PRs.

### Why both repos matter

Feature flags live in sentry but are **gated by billing plans in getsentry**. A flag that has zero `features.has()` calls in sentry might still be referenced in getsentry's plan feature lists, early adopter dicts, or custom feature handlers. Removing it from sentry without checking getsentry would break billing.

### Flag lifecycle in this codebase

1. Flag registered in `sentry/features/temporary.py` via `manager.add()`
2. Checked in sentry code via `features.has("organizations:flag-name", org)`
3. Optionally tied to a billing plan in `getsentry/billing/plans/*/features.py` (AM1/AM2/AM3 feature lists)
4. Optionally in `getsentry/features.py` FEATURE_EARLY_ADOPTERS dict (hardcoded org lists)
5. Optionally has a custom handler in `getsentry/features.py` (SubscriptionPlanFeatureHandler, etc.)
6. When mature: graduates to `sentry/features/permanent.py` and plan feature lists

### Implementation Steps

**A1. Build the scanner script** (`hackathon/flag-cleaner/scan.py`)

Parse registrations from:

- `src/sentry/features/temporary.py` — `manager.add("flag-name", ...)` (~300 flags)
- `src/sentry/features/permanent.py` — `"flag-name": True/False` dict (~40 flags)
- `../getsentry/getsentry/features.py` — `features.add("flag-name", ...)` at bottom (~30 getsentry-only flags)

Search for usage across **all three repos** and these patterns:

| Pattern                           | Where                                                    | Example                                                     |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `features.has("flag")`            | sentry + getsentry `.py`                                 | `features.has("organizations:gen-ai-features", org)`        |
| `self.feature("flag")`            | sentry test files                                        | `with self.feature("organizations:gen-ai-features"):`       |
| Flag name in feature lists        | `getsentry/billing/plans/*/features.py`                  | `AM3_BUSINESS_FEATURES = [..., "gen-ai-features", ...]`     |
| Flag name in early adopters       | `getsentry/features.py` FEATURE_EARLY_ADOPTERS           | `"organizations:event-attachments": EVENT_ATTACHMENTS_ORGS` |
| Flag name in handler classes      | `getsentry/features.py` handler `.features` sets         | Custom handler with `features = {"organizations:flag"}`     |
| Flag in DATA_CATEGORY_FEATURE_MAP | `getsentry/billing/plans/features.py`                    | Maps flags to billable data categories                      |
| String literal in frontend        | `static/**/*.{ts,tsx}`                                   | `organization.features.includes('flag-name')`               |
| Flagpole config                   | `sentry-options-automator/options/default/flagpole.yaml` | `"feature.organizations:gen-ai-features":` with segments    |
| Single-tenant whitelist           | `sentry-options-automator/options/regions/*/app.yaml`    | In `flagpole.allowed_features` list                         |

**sentry-options-automator** is critical because:

- `options/default/flagpole.yaml` (11,788 lines!) is the **production source of truth** for which orgs/users get which flags
- Each flag entry has: `created_at`, `enabled`, `owner` (team + email), and `segments` (rollout conditions)
- Single-tenant deployments (disney, geico, goldmansachs, ly) have explicit `flagpole.allowed_features` whitelists in their region YAML
- The `owner` field in flagpole.yaml gives us team ownership for free — no need to infer from CODEOWNERS
- The `created_at` field tells us when the flag was configured in prod — useful for staleness analysis

Output categories:

- **Dead**: Registered but zero usage anywhere (sentry + getsentry + frontend + tests) AND not in flagpole.yaml
- **Dead-except-tests**: Only used in test files
- **Ghost**: Called via `features.has()` but not registered anywhere
- **Stale**: Registered + used, but unchanged for 6+ months in both code AND flagpole.yaml
- **Plan-bound-only**: Not used in code, but exists in getsentry plan feature lists (billing-critical — manual review only)
- **Flagpole-configured-but-unused**: Has segments in flagpole.yaml but zero code references (config drift)
- **Flagpole-disabled**: Flag exists in flagpole.yaml with `enabled: false` — candidate for removal
- **Graduated-remnant**: In `permanent.py` but still has conditional `features.has()` checks that could be simplified
- **GA-everywhere**: In flagpole.yaml with a segment that has `rollout: 100` and no conditions (empty `conditions: []`) — flag is effectively always-on for everyone, candidate for graduation to permanent

**A2. Git staleness analysis**

- For each flag, `git log -1 --format=%cI` on registration line and sampled usage sites
- Flag as stale if most recent change > 6 months ago
- Add team ownership from `.github/CODEOWNERS` path matching

**A3. Generate report**

- Markdown report: `hackathon/flag-cleaner/report.md`
- Table: flag name | status | sentry usage count | getsentry usage count | plan-bound? | last modified | owner team
- Summary stats at top
- Separate section for "plan-bound-only" flags with a warning not to auto-remove

**A4. Generate cleanup PRs** (stretch goal)

- For clearly dead flags (zero usage in sentry + getsentry + frontend): remove registration line
- For graduated-remnants: remove `features.has()` conditionals (keep the "enabled" code path)
- NEVER auto-remove plan-bound flags — flag them for manual review

### Key files

**sentry:**

- `src/sentry/features/temporary.py` — ~300 temporary flag registrations
- `src/sentry/features/permanent.py` — ~40 graduated permanent flags
- `src/sentry/options/defaults.py` — options system (bonus: similar pattern)
- `.github/CODEOWNERS` — team ownership (746 lines)
- `static/` — frontend flag checks

**getsentry:**

- `getsentry/features.py` (2,515 lines) — handlers, early adopters, ~30 getsentry-only registrations
- `getsentry/billing/plans/features.py` — DATA_CATEGORY_FEATURE_MAP, active_features()
- `getsentry/billing/plans/am1/features.py` — AM1 plan feature lists
- `getsentry/billing/plans/am2/features.py` — AM2 plan feature lists (AM2_FREE → AM2_TEAM → AM2_BUSINESS → AM2_ENTERPRISE)
- `getsentry/billing/plans/am3/features.py` — AM3 plan feature lists
- `getsentry/feature_handlers/` — custom handlers (flagpole context builder, etc.)

**sentry-options-automator:**

- `options/default/flagpole.yaml` (11,788 lines) — production flag configs with segments, rollout %, owner info
- `options/regions/*/app.yaml` — region-specific overrides; single-tenant files have `flagpole.allowed_features` whitelists
- `python/src/flagpole/validate.py` — validation logic (naming conventions, schema)

### Edge cases to handle

- Flags use short names in getsentry plan lists (e.g. `"gen-ai-features"`) vs full names in sentry (e.g. `"organizations:gen-ai-features"`) — scanner must strip prefix when checking plan lists
- Flagpole.yaml uses `"feature.organizations:flag-name"` key format (prefixed with `feature.`) — strip that when matching
- Some flags in `temporary.py` have `default=True` — these are effectively always-on but still registered as temporary
- FEATURE_EARLY_ADOPTERS in getsentry hardcodes org ID lists — these flags are "active" even if not in plan lists
- `FeatureHandlerStrategy.FLAGPOLE` flags are remotely configured via flagpole.yaml — a flag with zero code references but live segments in flagpole.yaml is NOT dead
- Flagpole.yaml has `owner.team` and `owner.email` — use this as the authoritative owner instead of CODEOWNERS when available
- Single-tenant `flagpole.allowed_features` lists gate which flagpole flags are even evaluated — a flag not in a tenant's whitelist is disabled for that tenant regardless of its segments
- A flag with `enabled: false` in flagpole.yaml is globally disabled — strong removal candidate if also unused in code
- A flag with an unconditional GA segment (`rollout: 100`, `conditions: []`) is on for everyone — strong graduation candidate

### Verification

- Run scanner, spot-check 10 flagged items manually
- Verify no "dead" flag appears in any getsentry plan feature list
- For any auto-generated removal, run `pytest` on affected test files in both repos
- Compare dead flag count against manual expectations

---

## Project B: Auto Demo Generator (Days 1-3, staged)

### Goal

A tool that takes a natural language feature description and produces a demo video with voiceover. Staged — each stage is independently demo-able. Ship whatever we reach.

### How it works (end-to-end flow)

```
User: "Demo creating a new alert rule for Python errors"
  │
  ▼
[LLM generates two outputs simultaneously]
  ├── 1. Playwright script (browser actions + timing pauses)
  └── 2. Voiceover script (narration text + timing markers)
  │
  ▼
[Execution]
  ├── Playwright runs script → screen recording (WebM, 1920x1080)
  └── ElevenLabs API → voiceover audio (MP3)
  │
  ▼
[FFmpeg stitches]
  └── Final demo video (MP4) with synced narration + optional captions
```

### Stage 1: Playwright Script Generator (Day 1 evening / Day 2)

**B1. Set up Playwright**

```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

**B2. Directory structure** (`hackathon/demo-generator/`)

```
hackathon/demo-generator/
├── generate.ts          # Main: LLM prompt → Playwright script + voiceover script
├── record.ts            # Runs Playwright script with video recording
├── voiceover.ts         # ElevenLabs TTS integration
├── stitch.ts            # FFmpeg video + audio combiner
├── templates/           # Reusable script fragments
│   ├── login.ts         # Login flow (navigate, fill creds, submit)
│   ├── navigate.ts      # Route navigation helpers
│   └── seed-data.ts     # API calls to create test data before recording
├── scripts/             # Generated Playwright scripts (output)
├── videos/              # Recorded screen captures (output)
├── audio/               # Generated voiceover audio (output)
└── output/              # Final stitched videos (output)
```

**B3. The LLM prompt strategy**

This is the core of the project. The LLM needs to generate a working Playwright script. Two approaches:

**Option A: Template-based (safer, more reliable)**

- Pre-build 5-10 Playwright templates for common Sentry pages (issues list, alert creation, dashboard, settings)
- LLM picks the right template and fills in parameters (org slug, project name, form values, etc.)
- Pro: Scripts will work. Con: Limited to pre-built templates.

**Option B: Freeform generation (more impressive, riskier)**

- Feed the LLM: Sentry's route structure (`static/app/routes.tsx`), known `data-test-id` selectors, and a few example Playwright scripts
- LLM generates a full Playwright script from scratch
- Pro: Can demo anything. Con: Generated scripts may be broken.

**Recommended: Start with Option A for the demo day, extend to Option B as stretch goal.**

The generated script includes:

- Video recording config: `browser.newContext({ recordVideo: { dir: './videos', size: { width: 1920, height: 1080 } } })`
- Narration markers as structured comments: `// NARRATE: "Now we'll create a new alert rule..."`
- Deliberate pauses (`page.waitForTimeout(2000)`) so the video looks natural, not a blur of clicks
- Highlight/annotation hints: `// HIGHLIGHT: ".alert-rule-form"` (for post-processing)

**B4. Reusable templates to build**

- **Login**: Navigate to `/auth/login/`, fill email + password, submit, wait for redirect
- **Navigate to page**: Go to `/organizations/{org}/{path}/`, wait for content load
- **Seed data**: Before recording, call Sentry API to create sample events/projects/alerts so the UI has content
- **Form fill**: Generic template for filling forms (alert rules, project settings, etc.)
- **Screenshot pause**: Slow down and hover over key elements for the viewer

**B5. First test scenario**

- "Show the issues list page for a Python project with recent errors"
- Template: login → navigate to issues → wait for list to load → scroll through a few issues
- Success criteria: Playwright script runs, WebM video file is produced, looks like a real user browsing

### Stage 2: Voiceover Generation (Day 2)

**B6. Voiceover script generation**
The LLM generates the voiceover script at the same time as the Playwright script. Format:

```json
{
  "segments": [
    {
      "at_action": "navigate_to_issues",
      "text": "Let's take a look at the issues page for our Python project."
    },
    {
      "at_action": "click_first_issue",
      "text": "Here we can see recent errors. Let's click into this one."
    },
    {
      "at_action": "scroll_stacktrace",
      "text": "The stacktrace shows us exactly where the error occurred."
    }
  ],
  "total_estimated_duration": 45
}
```

**B7. ElevenLabs integration**

- API: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Body: `{ "text": "...", "model_id": "eleven_monolingual_v1" }`
- Response: MP3 audio stream
- Generate one MP3 per segment, then concatenate with silence gaps using FFmpeg
- Voice selection: Pick a natural, professional voice (ElevenLabs has pre-made ones)
- Free tier: 10,000 chars/month — enough for ~5-10 demo videos

**Timing sync approach:**

- After recording, parse the Playwright trace log for actual action timestamps
- Map each `// NARRATE:` marker to its real timestamp in the video
- Insert silence in the audio to match: `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t {gap_seconds} silence.mp3`

### Stage 3: Video + Audio Stitching (Day 2-3)

**B8. FFmpeg pipeline**

```bash
# Step 1: Combine video + narration audio
ffmpeg -i video.webm -i voiceover.mp3 \
  -c:v libx264 -c:a aac \
  -map 0:v:0 -map 1:a:0 \
  -shortest \
  combined.mp4

# Step 2 (optional): Add title card (3 seconds of text on black bg)
ffmpeg -f lavfi -i "color=c=black:s=1920x1080:d=3" \
  -vf "drawtext=text='Creating Alert Rules in Sentry':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  title.mp4

# Step 3 (optional): Concatenate title + main video
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4

# Step 4 (optional): Burn in captions from SRT
ffmpeg -i combined.mp4 -vf subtitles=captions.srt final.mp4
```

### Stage 4: Skill + Self-Demo (Day 3)

**B9. Package as Claude Code skill**

- Create a `/demo` skill that orchestrates the full pipeline:
  1. Takes a description as argument
  2. Calls LLM to generate Playwright script + voiceover script
  3. Runs Playwright with recording
  4. Calls ElevenLabs for TTS
  5. Runs FFmpeg to stitch
  6. Returns path to final MP4
- Single command: `/demo "Show the feature flag graveyard cleaner report"`

**B10. The meta demo**

- Use the demo generator to record a demo of itself running
- Offer to record demos for other teams' codeathon projects on Day 3
- Record a demo of the flag cleaner (Project A) to prove both projects work together

### Key dependencies

- `@playwright/test` — browser automation + native video recording
- ElevenLabs API key (free tier: 10,000 chars/month, or ~$5/month hobby)
- `ffmpeg` (likely already installed, or `brew install ffmpeg`)
- Sentry dev server running locally with test data

### Key files to reference

- `static/app/routes.tsx` — all frontend routes (what pages can be demoed)
- `fixtures/page_objects/` — existing Selenium navigation patterns to learn from
- `src/sentry/testutils/pytest/selenium.py` — browser automation patterns (click, wait, navigate)
- `static/app/utils/demoMode/` — demo mode infrastructure (tours, walkthrough state)

### Risks & mitigations

| Risk                         | Mitigation                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| Playwright scripts fragile   | Use `data-test-id` selectors; start with template approach (Option A)   |
| Video/audio timing mismatch  | Parse Playwright trace log for real timestamps; insert silence gaps     |
| ElevenLabs rate limits       | Cache audio; each unique text generates the same audio                  |
| Dev server needs test data   | Seed via API calls in the Playwright script preamble                    |
| LLM generates broken scripts | Template approach for Day 1; freeform as stretch goal                   |
| No dev server on demo day    | Pre-record videos the night before; show the tool + pre-recorded output |

### Verification

- Stage 1: Playwright script runs against local devserver, WebM video file produced
- Stage 2: Voiceover audio sounds natural, segments are properly spaced
- Stage 3: Final MP4 plays correctly with synced narration
- Stage 4: `/demo` skill produces end-to-end video from a single command

---

## Timeline

| Day             | Morning                                                                  | Afternoon                                | Evening                        |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------ |
| **Day 1 (Tue)** | Attend kickoff + talks. Set up project structure.                        | Build flag cleaner scanner (A1-A3)       | Start Playwright setup (B1-B2) |
| **Day 2 (Wed)** | Playwright script generator (B3-B5)                                      | Voiceover generator + ElevenLabs (B6-B7) | FFmpeg stitching (B8)          |
| **Day 3 (Thu)** | Polish, self-demo (B9-B10). Use demo generator to demo the flag cleaner. | Submit, watch videos, vote               | Celebrate                      |

---

## What gets shipped

1. **Flag cleaner report** showing orphaned flags (merged PR or visible artifact)
2. **Demo generator tool** (at whatever stage we reach)
3. **Demo video of the flag cleaner** (made by the demo generator — proof it works)
4. **Project ideas doc** for other teams to reference
