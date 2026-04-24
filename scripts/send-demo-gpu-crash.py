#!/usr/bin/env python
"""
Send a demo crash envelope with both a minidump and a .nv-gpudmp attachment
to exercise the teapot integration end-to-end locally.

The envelope carries one event + two attachments, which mirrors the SDK
contract the teapot integration assumes (see
~/teapot/docs/sentry-integration/02-relay-and-sdk.md for the contract).

Usage:
    scripts/send-demo-gpu-crash.py --dsn http://<public-key>@localhost:8000/1

    # Send minidump only (regression check — should still produce exactly one issue):
    scripts/send-demo-gpu-crash.py --skip-gpu --dsn ...

    # Send GPU-only envelope (Phase-next: verify GPU-only crashes are handled):
    scripts/send-demo-gpu-crash.py --skip-minidump --dsn ...

Prerequisites:
  * `sentry devservices up --mode=teapot` (brings up relay, symbolicator,
    teapot, ingest consumers, etc.)
  * `sentry devserver` running on port 8000
  * The DSN's project must have `organizations:gpu-crash-symbolication`
    enabled (set SENTRY_FEATURES in config/sentry.conf.py or toggle via
    the options endpoint).

On success, prints both issue URLs and the trace URL so you can open them
in the UI.
"""

from __future__ import annotations

import argparse
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import orjson
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MINIDUMP_FIXTURE = REPO_ROOT / "fixtures" / "native" / "windows.dmp"

# Lookup order for the GPU dump fixture. First existing match wins. Using the
# fixture that ships with teapot's tests avoids bundling a ~40KB binary into
# this repo just for the demo.
_CANDIDATE_GPU_FIXTURES = [
    REPO_ROOT.parent
    / "teapot"
    / "tests"
    / "fixtures"
    / "aftermath"
    / "D3D12HelloNsightAftermath-12252-1.nv-gpudmp",
]


def _default_gpu_fixture() -> Path | None:
    for candidate in _CANDIDATE_GPU_FIXTURES:
        if candidate.is_file():
            return candidate
    return None


def parse_dsn(dsn: str) -> tuple[str, str, str]:
    """Return (envelope_url, public_key, project_id) from a DSN string."""

    parsed = urlparse(dsn)
    if not parsed.username:
        sys.exit(f"invalid DSN (missing public key): {dsn!r}")
    project_id = parsed.path.lstrip("/")
    if not project_id:
        sys.exit(f"invalid DSN (missing project id): {dsn!r}")

    scheme = parsed.scheme or "http"
    host = parsed.hostname
    port = f":{parsed.port}" if parsed.port else ""
    envelope_url = f"{scheme}://{host}{port}/api/{project_id}/envelope/"
    return envelope_url, parsed.username, project_id


def build_envelope(
    *,
    event_id: str,
    trace_id: str,
    span_id: str,
    dsn: str,
    minidump_bytes: bytes | None,
    gpu_dump_bytes: bytes | None,
) -> bytes:
    """Assemble a newline-delimited envelope body."""

    sent_at = f"{time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime())}Z"
    header = {"event_id": event_id, "sent_at": sent_at, "dsn": dsn}

    event_payload = {
        "event_id": event_id,
        "timestamp": time.time(),
        "platform": "native",
        "level": "fatal",
        "contexts": {
            "trace": {
                "trace_id": trace_id,
                "span_id": span_id,
                "op": "gpu.crash.demo",
            },
            "device": {"model": "demo-rig", "type": "device"},
            "gpu": {"name": "GeForce RTX 4090 (demo)", "vendor_name": "NVIDIA"},
        },
        "tags": {"demo": "true", "teapot": "e2e"},
        "exception": {
            "values": [
                {
                    "type": "Minidump",
                    "value": "synthetic GPU+CPU crash",
                    "mechanism": {
                        "type": "minidump",
                        "handled": False,
                        "synthetic": True,
                    },
                }
            ]
        },
        "sdk": {"name": "teapot.demo-sender", "version": "0.1.0"},
    }
    event_body = orjson.dumps(event_payload)

    chunks: list[bytes] = []
    chunks.append(orjson.dumps(header) + b"\n")
    chunks.append(orjson.dumps({"type": "event", "length": len(event_body)}) + b"\n")
    chunks.append(event_body + b"\n")

    if minidump_bytes is not None:
        chunks.append(
            orjson.dumps(
                {
                    "type": "attachment",
                    "length": len(minidump_bytes),
                    "attachment_type": "event.minidump",
                    "filename": "crash.dmp",
                    "content_type": "application/x-minidump",
                }
            )
            + b"\n"
        )
        chunks.append(minidump_bytes + b"\n")

    if gpu_dump_bytes is not None:
        chunks.append(
            orjson.dumps(
                {
                    "type": "attachment",
                    "length": len(gpu_dump_bytes),
                    "attachment_type": "event.nv_gpudmp",
                    "filename": "crash.nv-gpudmp",
                    "content_type": "application/octet-stream",
                }
            )
            + b"\n"
        )
        chunks.append(gpu_dump_bytes + b"\n")

    # Canary attachment to test whether a known-accepted attachment_type makes
    # it through the same envelope — if this shows up but .nv-gpudmp doesn't,
    # Relay is stripping `event.nv_gpudmp` specifically.
    canary = b"canary-attachment\n"
    chunks.append(
        orjson.dumps(
            {
                "type": "attachment",
                "length": len(canary),
                "attachment_type": "event.attachment",
                "filename": "demo.log",
                "content_type": "text/plain",
            }
        )
        + b"\n"
    )
    chunks.append(canary + b"\n")

    return b"".join(chunks)


def send_envelope(envelope_url: str, public_key: str, body: bytes) -> requests.Response:
    """POST the envelope to Relay / Sentry and raise on non-2xx."""

    headers = {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": (
            f"Sentry sentry_version=7, sentry_client=teapot-demo/0.1.0, sentry_key={public_key}"
        ),
    }
    resp = requests.post(envelope_url, headers=headers, data=body, timeout=30)
    return resp


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dsn", required=True, help="Sentry DSN (from the project settings UI)")
    parser.add_argument(
        "--minidump",
        type=Path,
        default=DEFAULT_MINIDUMP_FIXTURE,
        help="Minidump file to attach (default: fixtures/native/windows.dmp)",
    )
    parser.add_argument(
        "--nv-gpudmp",
        type=Path,
        default=None,
        help=(
            "Path to a .nv-gpudmp file. Defaults to the teapot test fixture at "
            "../teapot/tests/fixtures/aftermath/*.nv-gpudmp when teapot is a sibling checkout."
        ),
    )
    parser.add_argument(
        "--skip-gpu",
        action="store_true",
        help="Omit the .nv-gpudmp attachment (regression check for CPU-only path)",
    )
    parser.add_argument(
        "--skip-minidump",
        action="store_true",
        help="Omit the minidump attachment (exercises GPU-only path)",
    )
    parser.add_argument(
        "--trace-id",
        default=None,
        help="Override the trace_id (32 hex). Handy for correlating with other telemetry.",
    )
    args = parser.parse_args()

    if args.skip_minidump and args.skip_gpu:
        sys.exit("nothing to send — both --skip-minidump and --skip-gpu were passed")

    envelope_url, public_key, project_id = parse_dsn(args.dsn)

    minidump_bytes: bytes | None = None
    if not args.skip_minidump:
        if not args.minidump.is_file():
            sys.exit(f"minidump fixture not found: {args.minidump}")
        minidump_bytes = args.minidump.read_bytes()

    gpu_bytes: bytes | None = None
    if not args.skip_gpu:
        nv_path = args.nv_gpudmp or _default_gpu_fixture()
        if nv_path is None:
            sys.exit(
                "no .nv-gpudmp fixture found — pass --nv-gpudmp PATH or check out "
                "the teapot repo as a sibling directory "
                "(expected at ../teapot/tests/fixtures/aftermath/)"
            )
        if not nv_path.is_file():
            sys.exit(f"gpu dump fixture not found: {nv_path}")
        gpu_bytes = nv_path.read_bytes()

    event_id = uuid.uuid4().hex
    trace_id = args.trace_id or uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]

    body = build_envelope(
        event_id=event_id,
        trace_id=trace_id,
        span_id=span_id,
        dsn=args.dsn,
        minidump_bytes=minidump_bytes,
        gpu_dump_bytes=gpu_bytes,
    )

    def _say(line: str = "") -> None:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    _say(f"  project_id: {project_id}")
    _say(f"  event_id:   {event_id}")
    _say(f"  trace_id:   {trace_id}")
    _say(f"  envelope:   {len(body):,} bytes")
    _say(f"  minidump:   {'yes' if minidump_bytes else 'no'}")
    _say(f"  gpu dump:   {'yes' if gpu_bytes else 'no'}")
    _say(f"  POST {envelope_url}")

    resp = send_envelope(envelope_url, public_key, body)
    _say(f"  → HTTP {resp.status_code} {resp.reason}")
    if resp.status_code >= 400:
        _say(f"  body: {resp.text[:500]}")
        return 1

    # The UI lags ingestion by a beat; nudge the user instead of polling.
    parsed = urlparse(args.dsn)
    base = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port:
        base += f":{parsed.port}"
    _say()
    _say("Sentry will ingest asynchronously. Check:")
    _say(f"  issues:  {base}/issues/?query=event.id%3A{event_id}")
    _say(f"  trace:   {base}/performance/trace/{trace_id}/")
    _say()
    _say("Expected on a clean pipeline:")
    if minidump_bytes and gpu_bytes:
        _say("  - 2 issues (CPU crash + GPU crash), both referencing this event_id")
    elif minidump_bytes:
        _say("  - 1 CPU issue (no GPU attachment sent)")
    else:
        _say("  - 1 GPU issue (no minidump sent)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
