import os
import subprocess
from pathlib import Path
from typing import Any

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.endpoints.workflow_runs import WorkflowEndpoint
from sentry.models.organization import Organization
from sentry.utils import json

from .examples import DEFAULT_FIXTURE, SCENARIOS, WORKFLOW_NOTES, example_input


@cell_silo_endpoint
class EditorEndpoint(WorkflowEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def convert_args(
        self, request: Request, organization_id_or_slug: str | int, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        if not settings.DEBUG:
            raise ResourceDoesNotExist
        return super().convert_args(request, organization_id_or_slug, *args, **kwargs)

    def get(self, request: Request, organization: Organization) -> Response:
        response = self.forward("GET", "", operation="definitions")
        if response.status_code != 200:
            return response
        workflow = response.data["definitions"][0]
        return Response(
            {
                "examples": {
                    workflow["name"]: {
                        "workflow": workflow,
                        "input": example_input(),
                        "label": "Breached metric monitor",
                        "description": "Broad scan → verification → judgments.",
                    }
                },
                "fixture": DEFAULT_FIXTURE,
                "scenarios": SCENARIOS,
                "workflow_notes": WORKFLOW_NOTES,
                "registry": response.data["registry"],
                "identity": f"{organization.slug} · {request.user.get_display_name()}",
                "environment": {
                    "organization_id": str(organization.id),
                    "actor_id": str(request.user.id),
                    "actor_type": "user",
                    "keep_proof_data": keep_proof_data(),
                },
            }
        )

    def post(self, request: Request, organization: Organization) -> Response:
        action = request.data.get("action")
        if action not in ("validate", "register", "proof"):
            return Response({"detail": "Unknown editor action."}, status=400)
        draft = {key: request.data.get(key) for key in ("workflow", "input")}
        path = "/definitions" if action == "register" else "/validate"
        response = self.forward("POST", path, operation=action, data=draft)
        if response.status_code != 200 or action != "proof":
            return response
        roots = [name for name, deps in response.data["dependencies"].items() if not deps]
        scenario = request.data.get("scenario")
        if not isinstance(scenario, str) or scenario not in SCENARIOS or scenario == "agent":
            return Response({"detail": "Unknown recovery scenario."}, status=400)
        if len(roots) != 1 or (node := draft["workflow"]["nodes"][roots[0]])["kind"] != "agent":
            return Response({"detail": "Recovery requires one starting agent."}, status=400)
        workflow = {
            **draft["workflow"],
            "notebook": False,
            "nodes": {roots[0]: node},
            "output": "$" + roots[0],
        }
        return recovery(
            scenario,
            {"workflow": workflow, "input": draft["input"], "fixture": request.data.get("fixture")},
            organization.id,
            request.user.id,
        )


def keep_proof_data() -> bool:
    return os.environ.get("WORKFLOW_LAB_KEEP_PROOF_DATA") == "1"


def recovery(scenario: str, payload: dict[str, Any], org_id: int, user_id: int) -> Response:
    # Only recovery scenarios load the local Seer Python environment and isolate their DB.
    root = Path(__file__).resolve().parent
    checkout = os.environ.get("WORKFLOW_LAB_SEER_CHECKOUT")
    candidates = (
        [Path(checkout)]
        if checkout
        else [root.parents[3] / name for name in ("Seer-loops", "seer")]
    )
    directory = next(
        (
            path
            for path in candidates
            if (path / ".venv/bin/python").is_file() and (path / "src/seer").is_dir()
        ),
        None,
    )
    if directory is None:
        return Response(
            {
                "detail": "Set WORKFLOW_LAB_SEER_CHECKOUT to the local Seer checkout to run recovery simulations."
            },
            status=503,
        )
    command = [
        str(directory / ".venv/bin/python"),
        str(root / "recovery.py"),
        "--proof-case",
        scenario,
        "--org-id",
        str(org_id),
        "--user-id",
        str(user_id),
    ]
    if keep_proof_data():
        command.append("--keep-proof-data")
    try:
        child = subprocess.run(
            command,
            input=json.dumps(payload),
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return Response({"detail": "The recovery simulation timed out."}, status=504)
    marker = "@@WORKFLOW_PROOF@@"
    events = [
        json.loads(line[len(marker) :])
        for line in child.stdout.splitlines()
        if line.startswith(marker)
    ]
    if not events:
        return Response(
            {
                "detail": "The recovery process could not start. Check the local Seer virtualenv and Postgres configuration."
            },
            status=503,
        )
    return Response({"success": child.returncode == 0, "events": events})
