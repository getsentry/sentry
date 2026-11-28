from uuid import UUID

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import (
    create_run,
    public_snapshot,
    update_checkpoint,
    worker_snapshot,
)
from sentry.models.organization import Organization
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.service_accounts.endpoints.organization_service_account_viewer_context import (
    SeerSystemViewerContextPermission,
)


class ActivityUpdate(serializers.Serializer):
    explorer_run_id = serializers.IntegerField(min_value=1)
    updatedAt = serializers.DateTimeField()
    session = serializers.DictField()


@cell_silo_endpoint
class WorkflowStorageEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = dict.fromkeys(("GET", "POST", "PUT", "PATCH"), ApiPublishStatus.PRIVATE)
    authentication_classes = (SeerRpcViewerContextAuthentication,)
    permission_classes = (SeerSystemViewerContextPermission,)

    def get(self, request: Request, organization: Organization, key: str) -> Response:
        runs = WorkflowRun.objects.filter(organization=organization)
        if request.GET.get("node") == "1":
            runs = runs.filter(nodes__uuid=key)
        else:
            runs = runs.filter(uuid=key)
        # Pair node rows with exactly the version from which they were read.
        with transaction.atomic(using=router.db_for_write(WorkflowRun)):
            run = runs.select_for_update(of=("self",)).get_or_none()
            if run is None:
                raise ResourceDoesNotExist
            if request.GET.get("view") in ("check", "public"):
                identity = run.checkpoint["execution_identity"]
                if request.GET.get("owner") != str(run.user_id) or request.GET.get(
                    "delegate", ""
                ) != str(identity.get("delegated_user_id") or ""):
                    raise ResourceDoesNotExist
                return Response(
                    {}
                    if request.GET["view"] == "check"
                    else public_snapshot(run, activity=request.GET.get("activity") == "1")
                )
            return Response(worker_snapshot(run))

    def post(self, request: Request, organization: Organization, key: str) -> Response:
        try:
            if UUID(request.data["run"]["id"]) != UUID(key):
                raise serializers.ValidationError("Wrong run ID.")
            run, created = create_run(
                organization,
                request.data["run"],
                request.data["definition"],
                request.data["nodes"],
                request.data.get("destination"),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise serializers.ValidationError("Invalid initial checkpoint.") from exc
        return Response({"id": str(run.uuid), "created": created})

    def put(self, request: Request, organization: Organization, key: str) -> Response:
        run = WorkflowRun.objects.filter(organization=organization, uuid=key).get_or_none()
        if run is None:
            raise ResourceDoesNotExist
        try:
            update_checkpoint(run, request.data)
        except (KeyError, TypeError, ValueError) as exc:
            raise serializers.ValidationError("Invalid checkpoint.") from exc
        return Response(status=204)

    def patch(self, request: Request, organization: Organization, key: str) -> Response:
        # Explorer snapshots may arrive out of order during a retry.
        with transaction.atomic(using=router.db_for_write(WorkflowNodeRun)):
            node = (
                WorkflowNodeRun.objects.select_for_update(of=("self",))
                .filter(uuid=key, run__organization=organization)
                .get_or_none()
            )
            if node is None:
                raise ResourceDoesNotExist
            validator = ActivityUpdate(data=request.data)
            validator.is_valid(raise_exception=True)
            entry = request.data
            child = str(entry["explorer_run_id"])
            previous = node.activity.get(child)
            if node.checkpoint.get("explorer_run_id") != int(child) and previous is None:
                return Response(status=204)
            if (
                previous is None
                or serializers.DateTimeField().to_internal_value(previous["updatedAt"])
                < validator.validated_data["updatedAt"]
            ):
                node.activity = {**node.activity, child: entry}
                node.save(update_fields=("activity", "date_updated"))
        return Response(status=204)
