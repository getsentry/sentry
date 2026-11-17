---
name: seer-automations-box
description: Create a box with Seer running and a breached metric monitor, Seer automation run and investigation already in it, for testing Seer automations end to end. Use when asked for "a Seer automations box", "a new box with the breach script run", "a box with a metric breach", or fresh Seer automation test data on a box.
---

# Seer Automations Box

Sets up a new [box](https://box.getsentry.net/docs) (Sentry's cloud dev VMs) with Seer serving and one realistic breached metric monitor. `bin/seer/trigger-metric-breach` seeds the monitor's data from Seer's investigation evals, breaches it, and starts a Seer automation run that opens an investigation.

Run every step with the `box` CLI from the user's laptop (or another box). Don't stop to ask between steps.

## 1. Create the box

```bash
box create <name> --json
```

Use the name the user gave, or let box pick one.

## 2. Check out branches (optional)

If the user named sentry or seer branches to test, check them out on the box in `/workspace/sentry` and `/workspace/seer`:

```bash
box exec <name> 'cd sentry && git fetch origin <branch> && git checkout -B <branch> FETCH_HEAD'
```

## 3. Turn on the Seer flags

Flagpole's rules for these flags include a `sentry_cell` condition that a box never matches, so they read False until they're overridden. Write `~/feature-overrides.json` on the box with this content. getsentry's org on a box has the slug `sentry`, and box's docs cover the file under `/docs/devserver#feature-flags`.

```json
{
  "feature.organizations:seer-automations": {
    "created_at": "2026-10-14",
    "enabled": true,
    "owner": {
      "team": "ml-ai"
    },
    "segments": [
      {
        "name": "box",
        "rollout": 100,
        "conditions": [
          {
            "property": "organization_slug",
            "operator": "equals",
            "value": "sentry"
          }
        ]
      }
    ]
  },
  "feature.organizations:investigations": {
    "created_at": "2026-08-25",
    "enabled": true,
    "owner": {
      "team": "ml-ai"
    },
    "segments": [
      {
        "name": "box",
        "rollout": 100,
        "conditions": [
          {
            "property": "organization_slug",
            "operator": "equals",
            "value": "sentry"
          }
        ]
      }
    ]
  },
  "feature.organizations:investigations-issue-links": {
    "created_at": "2026-11-10",
    "enabled": true,
    "owner": {
      "team": "issues"
    },
    "segments": [
      {
        "name": "box",
        "rollout": 100,
        "conditions": [
          {
            "property": "organization_slug",
            "operator": "equals",
            "value": "sentry"
          }
        ]
      }
    ]
  },
  "feature.organizations:seer-explorer": {
    "created_at": "2025-07-10",
    "enabled": true,
    "owner": {
      "team": "ml-ai"
    },
    "segments": [
      {
        "name": "box",
        "rollout": 100,
        "conditions": [
          {
            "property": "organization_slug",
            "operator": "equals",
            "value": "sentry"
          }
        ]
      }
    ]
  },
  "feature.organizations:seer-primary-nav": {
    "created_at": "2026-10-22",
    "enabled": true,
    "owner": {
      "team": "ml-ai"
    },
    "segments": [
      {
        "name": "box",
        "rollout": 100,
        "conditions": [
          {
            "property": "organization_slug",
            "operator": "equals",
            "value": "sentry"
          }
        ]
      }
    ]
  }
}
```

## 4. Serve Sentry and Seer

```bash
box serve <name> --seer
```

Wait until Seer answers: `box exec <name> 'until curl -sf localhost:9091/health/live; do sleep 2; done'`.

## 5. Run the breach script

A box serves getsentry's devserver, which uses the `getsentry` database, while a box shell's `SENTRY_CONF` points at plain Sentry's. Point the script at getsentry's settings so it reads the same database the devserver writes:

```bash
box exec <name> 'cd sentry && SENTRY_CONF=/workspace/getsentry/getsentry/settings.py .venv/bin/python bin/seer/trigger-metric-breach'
```

It takes about a minute and prints the issue, automation and investigation links. Each run seeds a new project and monitor, so rerunning always fires a new automation run.

## 6. Report

Give the user the box name and box's URL for people (from `box serve`'s output). The script's printed links use `http://dev.getsentry.net:8000`, which only works on the box, so swap that prefix for the box's URL. The investigation finishes in about 8 minutes.
