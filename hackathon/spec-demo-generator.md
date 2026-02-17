# Auto Demo Generator — Detailed Spec

**Project Name:** Lights, Camera, Sentry!

**Description:** An AI-powered tool that turns a plain-English feature description into a fully narrated demo video. Describe what you want to show, and it generates a Playwright script, records the browser session, adds AI voiceover via ElevenLabs, and stitches everything into a polished MP4 — all from a single command.

## Overview

A Python tool that takes a natural language feature description and produces a narrated demo video of that feature in the Sentry UI. Uses Playwright (Python) for browser recording, an LLM for script generation, ElevenLabs for voiceover, and FFmpeg for stitching.

## Architecture

```
hackathon/demo-generator/
├── cli.py                   # CLI entry point: parses args, orchestrates pipeline
├── generate_script.py       # LLM → Playwright script + voiceover script
├── record.py                # Runs Playwright script with video capture
├── voiceover.py             # ElevenLabs TTS + audio timing
├── stitch.py                # FFmpeg video + audio → final MP4
├── templates/
│   ├── preamble.py          # Login + data seeding boilerplate
│   ├── selectors.py         # Known data-test-id selectors for key UI elements
│   └── routes.py            # Key Sentry routes and their descriptions
├── scripts/                 # Generated Playwright scripts (output)
├── videos/                  # Playwright screen recordings (output)
├── audio/                   # ElevenLabs voiceover files (output)
└── output/                  # Final stitched MP4s (output)
```

## Pipeline Stages

### Stage 1: Script Generation (LLM)

**Input:** Natural language description

```
"Demo creating a new metric alert rule that triggers when error count exceeds 100 per hour"
```

**Output:** Two artifacts:

1. A Playwright Python script
2. A voiceover script with timing markers (JSON)

#### How the LLM prompt works

The prompt is constructed from:

**System context (static, loaded once):**

- Sentry route map (extracted from `static/app/routes.tsx`) — tells the LLM what pages exist
- Known `data-test-id` selectors for key UI elements (curated list, see below)
- A few example Playwright scripts showing the expected style
- Constraints: use `wait_for_selector` before clicks, add `page.wait_for_timeout(1500)` between major actions, include `# NARRATE:` comments

**User prompt (per-request):**

```
Generate a Playwright Python script that demos the following feature in the Sentry UI:

"{user's description}"

The script should:
1. Start already logged in (use the preamble template)
2. Navigate to the relevant page
3. Perform the actions slowly (1-2 seconds between clicks)
4. Include # NARRATE: "..." comments at each major step
5. End on a clear result screen

Also generate a voiceover script as a JSON array of { "action_id": ..., "text": ... } entries.
```

#### Curated selector list (`selectors.py`)

Instead of hoping the LLM knows Sentry's DOM, we provide a curated map:

```python
SELECTORS = {
    # Navigation
    "sidebar": '[data-test-id="sidebar"]',
    "sidebar_issues": '[data-test-id="sidebar-item-issues"]',
    "sidebar_alerts": '[data-test-id="sidebar-item-alerts"]',
    "sidebar_dashboards": '[data-test-id="sidebar-item-dashboards"]',
    "sidebar_settings": '[data-test-id="sidebar-item-settings"]',

    # Issues page
    "issues_list": '[data-test-id="group-list"]',
    "issue_row": '[data-test-id="group"]',
    "issue_title": '[data-test-id="issue-title"]',

    # Alert creation
    "create_alert_button": '[data-test-id="create-alert-rule"]',
    "alert_name_input": '[data-test-id="alert-name"]',
    "alert_save_button": '[data-test-id="save-rule"]',

    # General
    "loading_indicator": '[data-test-id="loading-indicator"]',
    "search_input": '[data-test-id="search-input"]',
    "submit_button": 'button[type="submit"]',
    # ... extend as needed
}
```

**To build this list:** Grep the sentry frontend for `data-test-id` attributes:

```bash
grep -roh 'data-test-id="[^"]*"' static/app/ | sort | uniq -c | sort -rn | head -100
```

#### Route map (`routes.py`)

Extracted from `static/app/routes.tsx`:

```python
ROUTES = {
    "issues": "/organizations/{org}/issues/",
    "issue_detail": "/organizations/{org}/issues/{issue_id}/",
    "alerts": "/organizations/{org}/alerts/",
    "alert_create": "/organizations/{org}/alerts/new/metric/",
    "dashboards": "/organizations/{org}/dashboards/",
    "settings": "/organizations/{org}/settings/",
    "project_settings": "/organizations/{org}/settings/projects/{project}/",
    "explore": "/organizations/{org}/explore/traces/",
    # ... key routes only, not exhaustive
}
```

#### Example generated Playwright script

```python
from playwright.sync_api import sync_playwright
from templates.selectors import SELECTORS

def demo():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            record_video_dir="./videos",
            record_video_size={"width": 1920, "height": 1080},
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        # Login (preamble)
        page.goto("http://localhost:8000/auth/login/")
        page.fill('input[name="username"]', "admin@sentry.io")
        page.fill('input[name="password"]', "admin")
        page.click('button[type="submit"]')
        page.wait_for_url("**/issues/**")
        page.wait_for_timeout(1000)

        # NARRATE: "Let's create a new metric alert rule for our Python project."
        # ACTION_ID: navigate_to_alerts
        page.click(SELECTORS["sidebar_alerts"])
        page.wait_for_selector(SELECTORS["create_alert_button"])
        page.wait_for_timeout(1500)

        # NARRATE: "We'll click Create Alert Rule to get started."
        # ACTION_ID: click_create
        page.click(SELECTORS["create_alert_button"])
        page.wait_for_timeout(2000)

        # NARRATE: "We'll set up a threshold alert that fires when errors exceed 100 per hour."
        # ACTION_ID: configure_alert
        # ... form interactions ...

        # NARRATE: "And save our new alert rule."
        # ACTION_ID: save_alert
        page.click(SELECTORS["alert_save_button"])
        page.wait_for_timeout(2000)

        # NARRATE: "Our metric alert is now active and monitoring for error spikes."
        # ACTION_ID: done
        page.wait_for_timeout(3000)

        context.close()
        browser.close()

if __name__ == "__main__":
    demo()
```

### Stage 2: Recording

**Execute the generated script with Playwright:**

```python
# record.py
import subprocess
import glob
import os

def record(script_path: str) -> str:
    """Run a generated Playwright script and return the video path."""
    subprocess.run(["python", script_path], check=True)

    # Playwright saves video to the configured dir
    # Find the most recent .webm file
    videos = sorted(glob.glob("./videos/*.webm"), key=os.path.getmtime)
    return videos[-1]
```

Playwright's `record_video_dir` automatically captures the browser viewport as a WebM file. No extra tooling needed.

**Resolution & quality:**

- 1920x1080 for HD demo videos
- Playwright encodes as VP8 WebM by default
- Frame rate is typically 25fps (sufficient for UI demos)

### Stage 3: Voiceover

**Voiceover script format** (generated alongside the Playwright script):

```json
[
  {
    "action_id": "navigate_to_alerts",
    "text": "Let's create a new metric alert rule for our Python project."
  },
  {
    "action_id": "click_create",
    "text": "We'll click Create Alert Rule to get started."
  },
  {
    "action_id": "configure_alert",
    "text": "We'll set up a threshold alert that fires when errors exceed 100 per hour."
  },
  {
    "action_id": "save_alert",
    "text": "And save our new alert rule."
  },
  {
    "action_id": "done",
    "text": "Our metric alert is now active and monitoring for error spikes."
  }
]
```

**ElevenLabs API integration:**

```python
# voiceover.py
import os
import requests

ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech"
VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # "Adam" - professional male voice
# Alternative: "21m00Tcm4TlvDq8ikWAM" ("Rachel" - professional female voice)

def generate_segment_audio(text: str) -> bytes:
    response = requests.post(
        f"{ELEVENLABS_API}/{VOICE_ID}",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": os.environ["ELEVENLABS_API_KEY"],
        },
        json={
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.75,
                "similarity_boost": 0.75,
            },
        },
    )
    response.raise_for_status()
    return response.content
```

**Timing synchronization:**

The key challenge is syncing voiceover to video. Approach:

1. **During recording**, Playwright logs action timestamps to a trace file. We can also parse the `# ACTION_ID:` comments from the script and map them to `wait_for_timeout` cumulative times.

2. **Simple approach (good enough for hackathon):** Calculate timing from the script itself:
   - Each `wait_for_timeout(ms)` adds `ms` to cumulative time
   - Each action (click, fill, navigate) adds ~500ms estimated
   - Map each `ACTION_ID` to its cumulative timestamp

3. **Compose audio with gaps:**

   ```python
   import subprocess
   from pathlib import Path

   def compose_voiceover(
       segments: list[dict],
       timings: dict[str, float],
   ) -> str:
       parts: list[str] = []
       current_time = 0.0

       for segment in segments:
           target_time = timings.get(segment["action_id"], current_time)
           gap = target_time - current_time

           if gap > 0.1:
               # Generate silence
               silence_path = f"/tmp/silence_{segment['action_id']}.mp3"
               subprocess.run([
                   "ffmpeg", "-y", "-f", "lavfi",
                   "-i", f"anullsrc=r=44100:cl=mono",
                   "-t", str(gap), "-q:a", "9", silence_path,
               ], check=True, capture_output=True)
               parts.append(silence_path)

           # Generate speech
           audio_data = generate_segment_audio(segment["text"])
           audio_path = f"./audio/{segment['action_id']}.mp3"
           Path(audio_path).write_bytes(audio_data)
           parts.append(audio_path)

           # Estimate speech duration (~150 wpm, ~5 chars per word)
           current_time = target_time + (len(segment["text"]) / 5 / 150 * 60)

       # Concatenate all parts
       list_file = "\n".join(f"file '{p}'" for p in parts)
       Path("/tmp/audio_list.txt").write_text(list_file)
       subprocess.run([
           "ffmpeg", "-y", "-f", "concat", "-safe", "0",
           "-i", "/tmp/audio_list.txt", "-c", "copy",
           "./audio/voiceover.mp3",
       ], check=True, capture_output=True)

       return "./audio/voiceover.mp3"
   ```

### Stage 4: Stitching

**FFmpeg pipeline:**

```python
# stitch.py
import subprocess
from pathlib import Path

def stitch(
    video_path: str,
    audio_path: str,
    output_path: str,
    title: str | None = None,
    subtitles_path: str | None = None,
) -> None:
    if title:
        # Step 1: Generate 3-second title card
        safe_title = title.replace("'", "\\'")
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=0x1B1025:s=1920x1080:d=3",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-vf", f"drawtext=text='{safe_title}':fontsize=56:fontcolor=white"
                   f":x=(w-text_w)/2:y=(h-text_h)/2",
            "-t", "3", "-c:v", "libx264", "-c:a", "aac",
            "-shortest", "/tmp/title_card.mp4",
        ], check=True, capture_output=True)

        # Step 2: Combine video + audio
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, "-i", audio_path,
            "-c:v", "libx264", "-c:a", "aac",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "/tmp/main_video.mp4",
        ], check=True, capture_output=True)

        # Step 3: Concatenate title + main
        Path("/tmp/concat_list.txt").write_text(
            "file '/tmp/title_card.mp4'\nfile '/tmp/main_video.mp4'"
        )
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", "/tmp/concat_list.txt", "-c", "copy", output_path,
        ], check=True, capture_output=True)
    else:
        # Simple: just combine video + audio
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, "-i", audio_path,
            "-c:v", "libx264", "-c:a", "aac",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            output_path,
        ], check=True, capture_output=True)

    # Optional: burn in subtitles
    if subtitles_path:
        subprocess.run([
            "ffmpeg", "-y", "-i", output_path,
            "-vf", f"subtitles={subtitles_path}",
            f"{output_path}.srt.mp4",
        ], check=True, capture_output=True)
        Path(f"{output_path}.srt.mp4").rename(output_path)
```

### Stage 5: CLI

```python
# cli.py
import argparse
import json
import re
from pathlib import Path

from generate_script import generate_script
from record import record
from voiceover import compose_voiceover
from stitch import stitch

# Usage:
#   python cli.py "Demo creating a new alert rule for high error rates"
#   python cli.py --script-only "Demo the issues list"
#   python cli.py --from-script scripts/my-script.py

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]

def calculate_timings(script_text: str) -> dict[str, float]:
    """Parse wait_for_timeout calls and ACTION_ID comments to build a timing map."""
    cumulative = 0.0
    timings: dict[str, float] = {}
    for line in script_text.splitlines():
        if "wait_for_timeout(" in line:
            match = re.search(r"wait_for_timeout\((\d+)\)", line)
            if match:
                cumulative += int(match.group(1)) / 1000.0
        elif "ACTION_ID:" in line:
            action_id = line.split("ACTION_ID:")[1].strip()
            timings[action_id] = cumulative
        elif any(kw in line for kw in [".click(", ".fill(", ".goto("]):
            cumulative += 0.5  # estimate action duration
    return timings

def main():
    parser = argparse.ArgumentParser(description="Generate a narrated Sentry demo video")
    parser.add_argument("description", help="Natural language description of the demo")
    parser.add_argument("--script-only", action="store_true", help="Only generate the script, don't record")
    parser.add_argument("--from-script", help="Use an existing script instead of generating one")
    parser.add_argument("--no-voiceover", action="store_true", help="Skip voiceover generation")
    args = parser.parse_args()

    output_name = slugify(args.description)
    Path("scripts").mkdir(exist_ok=True)
    Path("videos").mkdir(exist_ok=True)
    Path("audio").mkdir(exist_ok=True)
    Path("output").mkdir(exist_ok=True)

    if args.from_script:
        script_path = args.from_script
        script_text = Path(script_path).read_text()
    else:
        print("1/4 Generating Playwright script + voiceover script...")
        playwright_script, voiceover_script = generate_script(args.description)
        script_path = f"scripts/{output_name}.py"
        Path(script_path).write_text(playwright_script)
        Path(f"scripts/{output_name}.voiceover.json").write_text(
            json.dumps(voiceover_script, indent=2)
        )
        script_text = playwright_script

    if args.script_only:
        print(f"Script saved to: {script_path}")
        return

    print("2/4 Recording browser session...")
    video_path = record(script_path)

    if args.no_voiceover:
        print(f"Video saved to: {video_path}")
        return

    print("3/4 Generating voiceover audio...")
    voiceover_data = json.loads(
        Path(f"scripts/{output_name}.voiceover.json").read_text()
    )
    timings = calculate_timings(script_text)
    audio_path = compose_voiceover(voiceover_data, timings)

    print("4/4 Stitching final video...")
    final_path = f"output/{output_name}.mp4"
    stitch(
        video_path=video_path,
        audio_path=audio_path,
        output_path=final_path,
        title=args.description,
    )

    print(f"Done! Video saved to: {final_path}")

if __name__ == "__main__":
    main()
```

### Stage 6: Claude Code Skill (stretch)

If time permits, wrap the CLI as a Claude Code skill:

```
.claude/skills/demo.md:
---
name: demo
description: Generate a narrated demo video of a Sentry feature
user_invocable: true
---

# /demo

Generate a narrated demo video. Takes a description of the feature to demo.

## Steps:
1. Run `python hackathon/demo-generator/cli.py "{args}"` to generate the video
2. Report the output file path to the user
```

## Data Seeding

Before recording, the Playwright script's preamble should seed the dev server with realistic data. Options:

**Option A: API calls in the script**

```python
# Call Sentry API to create sample data
import requests
requests.post(
    "http://localhost:8000/api/0/projects/sentry/python/events/",
    json=sample_event_payload,
    headers={"Authorization": "Bearer ..."},
)
```

**Option B: Django management commands**

```bash
# Before running the script, seed via CLI
sentry django loaddata fixtures/demo-data.json
# or
python bin/mock-event --project python --count 50
```

**Option C: Use existing dev server data**

- Just `devservices serve` and use whatever data is already there
- Simplest, but may look empty

**Recommendation:** Option C for hackathon (simplest). Document Option A/B as improvements.

## LLM Provider for Script Generation

Two options for the LLM call in `generate_script.py`:

**Option A: Use Claude Code itself**

- The demo generator IS a Claude Code skill — Claude generates the script as part of the skill execution
- No API key needed, uses the user's existing Claude session
- Pro: Free, integrated. Con: Coupled to Claude Code.

**Option B: Direct API call**

- Call Anthropic API from the Python code (`anthropic` package)
- Requires API key in env
- Pro: Standalone tool. Con: Extra dependency.

**Recommendation:** Option A for hackathon — keeps it self-contained within Claude Code.

## Dependencies

```
# requirements.txt (or just pip install directly)
playwright
requests
```

```bash
# Install Playwright browsers
python -m playwright install chromium
```

Plus system dependencies:

- `ffmpeg` (`brew install ffmpeg`)
- ElevenLabs API key in `ELEVENLABS_API_KEY` env var
- Sentry dev server running on `localhost:8000`

## First Demo Script (for testing)

Test with something simple that doesn't need much data:

```
"Show the Sentry issues list page and click into a Python error to see the stacktrace"
```

This tests: login → navigate → click → wait → read. Minimal data needed (just one Python error event).

## What "Good Enough" Looks Like Per Stage

| Stage          | Minimum viable                                       | Nice to have                                |
| -------------- | ---------------------------------------------------- | ------------------------------------------- |
| 1 (Script gen) | Generated script runs without errors, video captured | Multiple templates, handles many page types |
| 2 (Recording)  | WebM file captured at 1080p                          | Cursor highlighting, smooth scrolling       |
| 3 (Voiceover)  | Audio segments play in roughly the right order       | Precisely synced to video actions           |
| 4 (Stitch)     | MP4 with video + audio combined                      | Title card, captions, fade transitions      |
| 5 (CLI)        | Single command produces video                        | Error handling, retry, progress bars        |
| 6 (Skill)      | `/demo` command works                                | Self-demo, batch mode                       |
