"""Sentry owns the checkpoint. Workers evaluate the graph against a versioned snapshot."""

from datetime import timedelta
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.db.models import Case, DateTimeField, Value, When
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook
from sentry.notebooks.services import NotebookValidationError
from sentry.notebooks.services.workflow import open_workflow_notebook

PAUSED_RECOVERY_INTERVAL = timedelta(hours=1)


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
                    target = Notebook.objects.filter(
                        organization=organization, pk=destination["notebookId"], status="active"
                    ).get_or_none()
                    if target is None:
                        raise serializers.ValidationError("Unknown notebook.")
                try:
                    notebook = open_workflow_notebook(
                        organization,
                        run.uuid,
                        destination=target,
                        title=definition["name"],
                        project_ids=destination["projectIds"],
                        creator={
                            "created_by_id": run.user_id,
                            "created_by_org_auth_token_id": None,
                            "created_by_service_account_id": None,
                        },
                    )
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
        mutable = {
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
