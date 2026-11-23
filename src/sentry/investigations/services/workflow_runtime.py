"""Sentry owns the checkpoint. Workers evaluate the graph against a versioned snapshot."""

from datetime import datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from django.db import router, transaction
from django.db.models import Case, DateTimeField, Value, When
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.actor_access import actor_can_investigate
from sentry.investigations.services.breached_metrics import resolve_investigation_source
from sentry.investigations.services.orchestration import (
    get_or_create_metric_workflow_notebook,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookSourceType, NotebookWorkflowRun
from sentry.notebooks.services import NotebookSourceNotFound, NotebookValidationError
from sentry.notebooks.services.workflow import open_workflow_notebook
from sentry.viewer_context import ActorId, ActorType

PAUSED_RECOVERY_INTERVAL = timedelta(hours=1)


def metric_workflow_request_id(notebook_id: int) -> UUID:
    return uuid5(NAMESPACE_URL, f"sentry:metric-investigation-v2:{notebook_id}")


class StaleWorkflow(APIException):
    status_code = 409
    default_detail = "Workflow state changed."


class NodeCheckpoint(serializers.Serializer):
    id = serializers.UUIDField()
    node_id = serializers.CharField(max_length=128)
    status = serializers.ChoiceField(
        choices=(
            "pending",
            "ready",
            "running",
            "awaiting_input",
            "succeeded",
            "failed",
            "cancelled",
        )
    )
    workflow_run_id = serializers.UUIDField()
    organization_id = serializers.IntegerField(min_value=1)
    item_index = serializers.IntegerField(min_value=0, allow_null=True)
    explorer_run_id = serializers.IntegerField(min_value=1, allow_null=True)
    state = serializers.DictField()
    attempt = serializers.IntegerField(min_value=0)
    next_check_at = serializers.DateTimeField(allow_null=True)


def save_nodes(run: WorkflowRun, values: list[dict[str, Any]]) -> None:
    for value in values:
        node = NodeCheckpoint(data=value)
        node.is_valid(raise_exception=True)
        if (
            value["workflow_run_id"] != str(run.uuid)
            or value["organization_id"] != run.organization_id
        ):
            raise serializers.ValidationError("Wrong workflow for node.")
        due = node.validated_data["next_check_at"]
        if value["status"] == "awaiting_input" and due is None and not value["state"].get("error"):
            due = timezone.now() + PAUSED_RECOVERY_INTERVAL
        if due and value.get("lease_expires_at"):
            due = max(due, serializers.DateTimeField().to_internal_value(value["lease_expires_at"]))
        WorkflowNodeRun.objects.update_or_create(
            run=run,
            uuid=node.validated_data["id"],
            defaults={"checkpoint": value, "next_check_at": due},
        )


def _breach_source(
    definition: dict[str, Any],
    workflow_input: dict[str, Any],
    destination: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Read the breach identity from Seer's normalized input when the caller chose no notebook."""
    if (
        definition["name"] != "breached_metrics"
        or not definition.get("notebook")
        or destination is None
        or destination.get("notebookId") is not None
    ):
        return None
    seed = workflow_input.get("seed", {})
    if not isinstance(seed, dict):
        return None
    source = seed.get("sentrySource")
    if source is None:
        if seed.get("openPeriodId") is None or seed.get("metricIssueId") is None:
            return None
        source = {
            "type": "metric_open_period",
            "ref": {"groupId": seed["metricIssueId"], "openPeriodId": seed["openPeriodId"]},
        }
    if not isinstance(source, dict):
        raise serializers.ValidationError({"source": "Expected a metric open period."})
    return source


def _breach_notebook(
    organization: Organization,
    source: dict[str, Any],
    detector_id: int,
    project_ids: list[int],
    creator: ActorId,
) -> tuple[Notebook, bool]:
    resolved = resolve_investigation_source(
        organization=organization, source=source, accessible_project_ids=set(project_ids)
    )
    if str(detector_id) != resolved.source["snapshot"]["monitor"]["id"]:
        raise NotebookValidationError({"source": "The open period belongs to a different monitor."})
    return get_or_create_metric_workflow_notebook(
        organization=organization,
        creator=creator,
        title=None,
        resolved_source=resolved,
        # As on the monitor page, leave the selection open for related evidence.
        project_ids=[],
        filters={},
    )


def create_run(
    organization: Organization,
    checkpoint: dict[str, Any],
    definition: dict[str, Any],
    nodes: list[dict[str, Any]],
    destination: dict[str, Any] | None,
) -> tuple[WorkflowRun, bool]:
    identity = checkpoint["execution_identity"]
    if (
        identity["organization_id"] != organization.id
        or checkpoint["organization_id"] != organization.id
        or not identity["actor_id"]
        or identity["actor_type"] != "user"
    ):
        raise serializers.ValidationError("Invalid workflow owner.")
    source = _breach_source(definition, checkpoint["input"], destination)
    creator = ActorId(ActorType.USER, identity["actor_id"])
    if source is not None and not actor_can_investigate(
        organization=organization, actor=creator, project_ids=[]
    ):
        raise PermissionDenied
    with transaction.atomic(using=router.db_for_write(WorkflowRun)):
        run, created = WorkflowRun.objects.get_or_create(
            organization=organization,
            request_id=UUID(checkpoint["request_id"]),
            defaults={
                "uuid": UUID(checkpoint["id"]),
                "checkpoint": checkpoint,
                "definition": definition,
                "user_id": identity["actor_id"],
            },
        )
        if created:
            if definition.get("notebook"):
                if destination is None:
                    raise serializers.ValidationError("Missing notebook destination.")
                target = None
                if destination.get("notebookId") is not None:
                    target = (
                        Notebook.objects.select_for_update()
                        .filter(
                            organization=organization, pk=destination["notebookId"], status="active"
                        )
                        .get_or_none()
                    )
                    if target is None:
                        raise serializers.ValidationError("Unknown notebook.")
                    if previous := destination.get("previousRunId"):
                        latest = (
                            NotebookWorkflowRun.objects.filter(notebook=target)
                            .order_by("-id")
                            .values_list("run_id", flat=True)
                            .first()
                        )
                        if latest != UUID(previous):
                            raise StaleWorkflow("Another run has already taken over this notebook.")
                try:
                    new_breach_notebook = False
                    if source is not None:
                        target, new_breach_notebook = _breach_notebook(
                            organization,
                            source,
                            checkpoint["input"]["detector_id"],
                            destination["projectIds"],
                            creator,
                        )
                    notebook = open_workflow_notebook(
                        organization,
                        run.uuid,
                        destination=target,
                        generate_placeholder_title=new_breach_notebook
                        or (
                            target is not None
                            and target.source_type == NotebookSourceType.METRIC_OPEN_PERIOD
                            and (target.source_key or "").startswith("v2:")
                            and run.request_id == metric_workflow_request_id(target.id)
                        ),
                        title=definition["name"],
                        project_ids=destination["projectIds"],
                        creator={
                            "created_by_id": run.user_id,
                            "created_by_org_auth_token_id": None,
                            "created_by_service_account_id": None,
                        },
                    )
                except NotebookSourceNotFound as exc:
                    raise serializers.ValidationError(
                        {"source": "Unknown metric open period."}
                    ) from exc
                except NotebookValidationError as exc:
                    raise serializers.ValidationError(exc.errors) from exc
                run.checkpoint = {**checkpoint, "notebook_id": notebook.id}
                run.save(update_fields=["checkpoint"])
            save_nodes(run, nodes)
        elif any(
            run.checkpoint[key] != checkpoint[key]
            for key in ("workflow_id", "input", "max_attempts", "execution_identity")
        ):
            raise StaleWorkflow("Request ID already used for another workflow.")
        return run, created


def cancel_notebook_workflows(notebook: Notebook) -> None:
    """Fence pending writes and leave claimed Explorer children due for Seer's stop sweep."""
    bindings = NotebookWorkflowRun.objects.filter(notebook=notebook).values("run_id")
    runs = WorkflowRun.objects.select_for_update().filter(
        organization_id=notebook.organization_id,
        uuid__in=bindings,
        checkpoint__status__in=["pending", "running", "awaiting_input"],
    )
    now = timezone.now()
    for run in runs:
        for node in run.nodes.exclude(checkpoint__status__in=["succeeded", "failed", "cancelled"]):
            saved = node.checkpoint
            if saved["state"].get("kind") == "llm":
                saved.update(lease_token=None, lease_expires_at=None)
                saved["state"]["dispatch_token"] = None
                due = None
            else:
                due = now if saved["attempt"] else None
            saved.update(status="cancelled", next_check_at=due.isoformat() if due else None)
            node.update(checkpoint=saved, next_check_at=due)
        if clock := run.checkpoint.get("active_clock"):
            if since := clock.get("since"):
                clock["seconds"] += max(0, (now - datetime.fromisoformat(since)).total_seconds())
                clock["since"] = None
        run.checkpoint.update(status="cancelled", finished_at=now.isoformat(), next_check_at=None)
        run.update(checkpoint=run.checkpoint, version=run.version + 1)


def worker_snapshot(run: WorkflowRun) -> dict[str, Any]:
    return {
        "run": {k: v for k, v in run.checkpoint.items() if k != "usage"},
        "version": run.version,
        "nodes": list(run.nodes.order_by("id").values_list("checkpoint", flat=True)),
    }


def update_checkpoint(run: WorkflowRun, data: dict[str, Any]) -> None:
    with transaction.atomic(using=router.db_for_write(WorkflowRun)):
        run = WorkflowRun.objects.select_for_update().get(pk=run.pk)
        if run.version != data["version"]:
            raise StaleWorkflow()
        if lease := data.get("lease"):
            node = run.nodes.filter(uuid=lease["node"]).get_or_none()
            if (
                node is None
                or node.checkpoint.get("lease_token") != lease["token"]
                or not node.checkpoint.get("lease_expires_at")
            ):
                raise StaleWorkflow()
            expires = serializers.DateTimeField().to_internal_value(
                node.checkpoint["lease_expires_at"]
            )
            if expires <= timezone.now():
                raise StaleWorkflow()
        now = timezone.now()
        previous = run.checkpoint
        clock = previous.get("active_clock", {})
        since = (
            clock.get("since")
            if clock
            else (previous.get("started_at") if previous["status"] == "running" else None)
        )
        mutable = {
            "steering",
            "followups",
            "started_at",
            "finished_at",
            "status",
            "error",
            "next_check_at",
            "notebook_id",
            "notebook_writer_uuid",
        }
        run.checkpoint = {
            **run.checkpoint,
            **{k: v for k, v in data["run"].items() if k in mutable},
        }
        if "usage" in data:
            run.checkpoint["usage"] = data["usage"]
        save_nodes(run, data["nodes"])
        if any(
            n["node_id"] == "notebook/metadata" and n["status"] == "succeeded"
            for n in data["nodes"]
        ):
            run.checkpoint["report_ready"] = True
        ticking = (
            run.checkpoint["status"] == "running"
            and run.checkpoint.get("started_at")
            and not run.checkpoint.get("report_ready")
        )
        seconds = clock.get("seconds", 0)
        if since and not ticking:
            end = parse_datetime(run.checkpoint.get("finished_at") or "") or now
            seconds += max(0, (end - datetime.fromisoformat(since)).total_seconds())
        run.checkpoint["active_clock"] = {
            "seconds": seconds,
            "since": (since or (now.isoformat() if clock else run.checkpoint["started_at"]))
            if ticking
            else None,
        }
        run.version += 1
        run.save(update_fields=("checkpoint", "version", "date_updated"))


def public_snapshot(run: WorkflowRun, *, activity: bool) -> dict[str, Any]:
    saved = run.checkpoint
    definition = run.definition
    nodes = []
    output = None
    notebook = bool(definition.get("notebook"))
    output_name = "notebook/write" if notebook else definition["output"].removeprefix("$")
    for row in run.nodes.order_by("id"):
        node = row.checkpoint
        state = node["state"]
        name = node["node_id"]
        if name == output_name:
            output = state.get("output")
        dependencies = state.get("dependencies")
        if dependencies is None:
            dependencies = (
                list(definition["nodes"])
                if name == "notebook/write"
                else ["notebook/write"]
                if name in ("notebook/metadata", "notebook/next_steps")
                else []
            )
        nodes.append(
            {
                "id": str(row.uuid),
                "name": name,
                "status": node["status"],
                "dependencies": dependencies,
                "role": state.get("role"),
                "kind": state.get("kind") or state.get("definition", {}).get("kind", "agent"),
                "phase": state.get("phase"),
                "progress": state.get("progress"),
                "usage": state.get("usage", {}),
                "updatedAt": row.date_updated,
                "nextCheckAt": node["next_check_at"],
                "attempts": list(row.activity.values()) if activity else [],
                "parent": state.get("parent_id"),
                "item": node["item_index"],
                "round": state.get("round"),
                "attempt": node["attempt"],
                "child": node["explorer_run_id"],
                "error": state.get("error"),
                "input": state.get("items", state.get("input_value", state.get("input"))),
                "output": state.get("output"),
            }
        )
    return {
        "id": str(run.uuid),
        "status": saved["status"],
        "done": saved["status"] in ("failed", "cancelled", "succeeded"),
        "notebook": notebook,
        "notebookId": str(saved["notebook_id"]) if saved.get("notebook_id") else None,
        "createdAt": run.date_added,
        "finishedAt": saved.get("finished_at"),
        "error": saved.get("error"),
        "workflow": definition,
        "input": saved["input"],
        "output": output if not notebook or saved["status"] == "succeeded" else None,
        "maxAttempts": saved["max_attempts"],
        "nodes": nodes,
        "usage": saved.get("usage", {"usages": []}),
        "version": run.version,
    }


def reserve_due_nodes(*, run: WorkflowRun | None = None) -> dict[int, list[str]]:
    now = timezone.now()
    batches: dict[int, list[str]] = {}
    with transaction.atomic(using=router.db_for_write(WorkflowNodeRun)):
        due = WorkflowNodeRun.objects.select_for_update(skip_locked=True, of=("self",)).filter(
            next_check_at__lte=now
        )
        if run is not None:
            due = due.filter(run=run)
        rows = list(
            due.order_by("next_check_at", "id").values_list("id", "run__organization_id", "uuid")[
                :100
            ]
        )
        WorkflowNodeRun.objects.filter(pk__in=[pk for pk, _, _ in rows]).update(
            next_check_at=Case(
                When(
                    checkpoint__status="awaiting_input",
                    checkpoint__next_check_at=None,
                    then=Value(now + PAUSED_RECOVERY_INTERVAL),
                ),
                default=Value(now + timedelta(minutes=1)),
                output_field=DateTimeField(),
            )
        )
        for _, org, node in rows:
            batches.setdefault(org, []).append(str(node))
    return batches
