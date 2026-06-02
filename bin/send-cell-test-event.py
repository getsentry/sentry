#!/usr/bin/env python
"""Send a test event through the cell-routing edge relay using the Sentry SDK.

Pair with `devservices up --mode cell-routing`. Resolves a project key from the
local dev database (the internal project, id 1, which every dev install
bootstraps — override with PROJECT_ID), points a DSN at the edge relay on :7901,
and captures an event with sentry_sdk.
The edge reads the advertised upstream from its project config and forwards the
envelope there (relay-cell), which processes it to Kafka -> Sentry.

Unlike the curl helper, this exercises the real SDK envelope path
(/api/<id>/envelope/), which is closer to how an actual client talks to Relay.

Usage (with the dev env active):
    bin/send-cell-test-event.py
    PROJECT_ID=42 bin/send-cell-test-event.py
    TARGET=127.0.0.1:7900 bin/send-cell-test-event.py   # override: e.g. straight to relay-cell
"""

# CLI helper: printing to the terminal is the whole point. `print` is flagged by
# both linters under different codes, each needing its own file-level directive.
# ruff: noqa: T201
# flake8: noqa: S002

from __future__ import annotations

import os

from sentry.runner import configure

configure()

from sentry.models.project import Project  # noqa: E402
from sentry.models.projectkey import ProjectKey  # noqa: E402

# Defaults to the edge relay's address from devservices/config.yml (cell-routing
# mode). Override TARGET to send elsewhere, e.g. straight to relay-cell on :7900.
target = os.environ.get("TARGET", "127.0.0.1:7901")
# The internal project (id 1) is bootstrapped for every dev install.
project_id = os.environ.get("PROJECT_ID", "1")
project = Project.objects.filter(id=project_id).first()
key = ProjectKey.get_default(project) if project else None
if key is None:
    raise SystemExit(
        f"no active store key found for project {project_id} in dev db "
        "(is the devserver bootstrapped? try PROJECT_ID=<id>)"
    )

# Point the DSN host at the edge relay rather than at Sentry directly.
dsn = f"http://{key.public_key}@{target}/{key.project_id}"
print(f"Using DSN {dsn}")
print("(watch the edge route it: docker logs -f sentry-relay-edge-1)")

import sentry_sdk  # noqa: E402

# Send via an isolated scope + client so we don't replace Sentry's own global SDK.
client = sentry_sdk.Client(dsn=dsn, default_integrations=False, traces_sample_rate=0)
with sentry_sdk.new_scope() as scope:
    scope.set_client(client)
    event_id = scope.capture_message("cell-routing test", level="error")
client.flush(timeout=5)

print(f"sent event {event_id} via {target}")
