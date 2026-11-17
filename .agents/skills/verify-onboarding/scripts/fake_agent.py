#!/usr/bin/env python3
"""Act as the coding agent on the far side of an agent handoff, using only public HTTP endpoints.

It does what a real agent does after the user pastes the prompt: claims the handoff code at
/agent-handoff.md, redeems the setup code at /oauth/token/, reports progress with the run code,
creates a project, sends a verification error through the DSN, and completes the run.

    python3 .agents/skills/verify-onboarding/scripts/fake_agent.py \\
        --org <org-slug> --team <team-slug> --har <capture.har> --out <transcript.json> \\
        [--platform javascript-react] [--stop-after <stage>] [--fail-at <stage>] [--delay <seconds>]

The transcript records each call's method, path, and status. Codes and tokens are redacted.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

STAGES = (
    "connect_mcp",
    "analyze_project",
    "create_project",
    "instrument_app",
    "plan_test_error",
    "send_verification_error",
    "receive_verification_error",
    "prepare_production",
    "check_stack_trace_quality",
)
SETUP_GRANT = "urn:sentry:params:oauth:grant-type:setup_code"


class Agent:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None
        self.transcript: list[dict[str, Any]] = []

    def request(
        self,
        method: str,
        path: str,
        *,
        form: dict[str, str] | None = None,
        body: Any = None,
        headers: dict[str, str] | None = None,
        expect: tuple[int, ...] = (200, 201),
    ) -> tuple[int, str]:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        all_headers = dict(headers or {})
        data = None
        if form is not None:
            data = urllib.parse.urlencode(form).encode()
            all_headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif body is not None:
            data = json.dumps(body).encode()
            all_headers["Content-Type"] = "application/json"
        if self.token and "/api/0/" in url:
            all_headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(url, data=data, headers=all_headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                status, text = response.status, response.read().decode()
        except urllib.error.HTTPError as error:
            status, text = error.code, error.read().decode()
        self.transcript.append(
            {"method": method, "path": urllib.parse.urlsplit(url).path, "status": status}
        )
        if status not in expect:
            raise SystemExit(f"fake-agent: {method} {url} returned {status}: {text[:500]}")
        return status, text

    def report(
        self, org: str, run_code: str, stage: str, status: str, **fields: Any
    ) -> dict[str, Any]:
        payload = {
            "schemaVersion": 1,
            "runToken": run_code,
            "stage": stage,
            "status": status,
            **fields,
        }
        _, text = self.request(
            "POST", f"/api/0/organizations/{org}/onboarding/agent/status/", body=payload
        )
        run = json.loads(text)
        self.transcript[-1]["stage"] = f"{stage}={status}"
        self.transcript[-1]["run_status"] = run.get("runStatus")
        return run


def handoff_code_from_har(har_path: Path) -> str:
    har = json.loads(har_path.read_text())
    for entry in reversed(har["log"]["entries"]):
        if (
            "/agent-handoff/prompts/" in entry["request"]["url"]
            and entry["response"]["status"] == 201
        ):
            return json.loads(entry["response"]["content"]["text"])["code"]
    raise SystemExit(f"fake-agent: no successful agent-handoff/prompts/ response in {har_path}")


def match(pattern: str, text: str, name: str) -> str:
    found = re.search(pattern, text)
    if not found:
        raise SystemExit(f"fake-agent: the claimed guide has no {name}")
    return found.group(1)


def send_error(agent: Agent, dsn: str, message: str) -> str:
    parts = urllib.parse.urlsplit(dsn)
    project_id = parts.path.strip("/")
    event_id = uuid.uuid4().hex
    auth = (
        f"Sentry sentry_version=7, sentry_client=verify-onboarding/1.0, sentry_key={parts.username}"
    )
    event = {
        "event_id": event_id,
        "platform": "javascript",
        "level": "error",
        "exception": {"values": [{"type": "Error", "value": message}]},
    }
    agent.request(
        "POST",
        f"{parts.scheme}://{parts.hostname}:{parts.port}/api/{project_id}/store/",
        body=event,
        headers={"X-Sentry-Auth": auth},
    )
    return event_id


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--base-url", default="http://dev.getsentry.net:8000")
    parser.add_argument("--org", required=True)
    parser.add_argument("--team", required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--har", type=Path, help="HAR captured while the user clicked Copy agent prompt"
    )
    source.add_argument("--code", help="handoff code, when it was read another way")
    parser.add_argument("--platform", default="javascript-react")
    parser.add_argument("--project-name", default="agent-react-app")
    parser.add_argument(
        "--stop-after", choices=STAGES, help="leave the run in progress after this stage"
    )
    parser.add_argument("--fail-at", choices=STAGES, help="fail the run at this stage")
    parser.add_argument(
        "--delay", type=float, default=0, help="seconds to wait after each stage, to watch the UI"
    )
    parser.add_argument("--out", type=Path, required=True, help="transcript JSON path")
    args = parser.parse_args()

    agent = Agent(args.base_url)
    result: dict[str, Any] = {"org": args.org}
    try:
        code = args.code or handoff_code_from_har(args.har)
        agent.request("GET", "/agent-handoff.md")
        _, guide = agent.request("POST", "/agent-handoff.md", form={"handoff_code": code})
        client_id = match(r"SENTRY_CLIENT_ID=(\S+)", guide, "SENTRY_CLIENT_ID")
        setup_code = match(r"SENTRY_SETUP_CODE=(\S+)", guide, "SENTRY_SETUP_CODE")
        run_code = match(r"onboarding run code is `([A-Za-z0-9]{10})`", guide, "run code")
        result["guide_has_org_slug"] = (
            f"Organization slug: {args.org.replace('-', chr(92) + '-')}" in guide
        )

        _, token_text = agent.request(
            "POST",
            "/oauth/token/",
            form={"grant_type": SETUP_GRANT, "client_id": client_id, "setup_code": setup_code},
        )
        agent.token = json.loads(token_text)["access_token"]

        def step(stage: str, status: str = "completed", **fields: Any) -> dict[str, Any]:
            if stage == args.fail_at:
                run = agent.report(
                    args.org,
                    run_code,
                    stage,
                    "failed",
                    eventNote="verify-onboarding injected failure",
                    runStatus="failed",
                )
                result["run_status"] = run["runStatus"]
                raise StopIteration
            run = agent.report(args.org, run_code, stage, status, **fields)
            result["run_status"] = run["runStatus"]
            if stage == args.stop_after:
                raise StopIteration
            time.sleep(args.delay)
            return run

        step("connect_mcp", extra={"method": "cli"})
        step("analyze_project")
        _, project_text = agent.request(
            "POST",
            f"/api/0/teams/{args.org}/{args.team}/projects/",
            body={"name": args.project_name, "platform": args.platform},
        )
        project = json.loads(project_text)
        result["project_slug"] = project["slug"]
        step("create_project", extra={"projectSlugs": [project["slug"]]})
        _, keys_text = agent.request("GET", f"/api/0/projects/{args.org}/{project['slug']}/keys/")
        dsn = json.loads(keys_text)[0]["dsn"]["public"]
        step("instrument_app")
        step("plan_test_error")
        result["event_id"] = send_error(agent, dsn, "verify-onboarding agent test error")
        step("send_verification_error")

        issue_ids: list[str] = []
        for _ in range(60):
            _, issues_text = agent.request(
                "GET", f"/api/0/projects/{args.org}/{project['slug']}/issues/?statsPeriod=24h"
            )
            issue_ids = [issue["id"] for issue in json.loads(issues_text)]
            if issue_ids:
                break
            time.sleep(2)
        if not issue_ids:
            raise SystemExit(
                "fake-agent: the verification error never became an issue; is ingest running?"
            )
        result["issue_ids"] = issue_ids
        step("receive_verification_error", extra={"issueIds": issue_ids[:1]})
        step("prepare_production")
        step("check_stack_trace_quality", "skipped", runStatus="completed")
    except StopIteration:
        pass
    finally:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({**result, "calls": agent.transcript}, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
