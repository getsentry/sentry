from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.replays.endpoints.project_replay_endpoint import ProjectReplayEndpoint
from sentry.replays.models import ReplayDeletionJobModel
from sentry.replays.permissions import has_replay_permission
from sentry.replays.tasks import run_bulk_replay_delete_job


class ReplayDeletionJobPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
    }


class ReplayDeletionJobSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": obj.id,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "rangeStart": obj.range_start,
            "rangeEnd": obj.range_end,
            "environments": obj.environments,
            "status": obj.status,
            "query": obj.query,
            "countDeleted": obj.offset,
        }


class ReplayDeletionJobCreateDataSerializer(serializers.Serializer):
    rangeStart = serializers.DateTimeField(required=True)
    rangeEnd = serializers.DateTimeField(required=True)
    environments = serializers.ListField(
        child=serializers.CharField(allow_null=False, allow_blank=False), required=True
    )
    query = serializers.CharField(required=True, allow_blank=True, allow_null=True)

    def validate(self, data):
        if data["rangeStart"] >= data["rangeEnd"]:
            raise serializers.ValidationError("rangeStart must be before rangeEnd")
        return data


class ReplayDeletionJobCreateSerializer(serializers.Serializer):
    data = ReplayDeletionJobCreateDataSerializer(required=True)  # type: ignore[assignment]


@region_silo_endpoint
class ProjectReplayDeletionJobsIndexEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ReplayDeletionJobPermission,)

    def get(self, request: Request, project) -> Response:
        """
        Retrieve a collection of replay delete jobs.
        """
        if not has_replay_permission(request, project.organization):
            return Response(status=403)

        queryset = ReplayDeletionJobModel.objects.filter(
            organization_id=project.organization_id, project_id=project.id
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: {
                "data": serialize(x, request.user, ReplayDeletionJobSerializer())
            },
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, project) -> Response:
        """
        Create a new replay deletion job.
        """
        if not has_replay_permission(request, project.organization):
            return Response(status=403)

        serializer = ReplayDeletionJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data["data"]

        # Create the deletion job
        job = ReplayDeletionJobModel.objects.create(
            range_start=data["rangeStart"],
            range_end=data["rangeEnd"],
            environments=data["environments"],
            organization_id=project.organization_id,
            project_id=project.id,
            query=data["query"] or "",
            status="pending",
        )

        # We don't check Seer features because an org may have previously had them on, then turned them off.
        has_seer_data = features.has("organizations:replay-ai-summaries", project.organization)

        # We always start with an offset of 0 (obviously) but future work doesn't need to obey
        # this. You're free to start from wherever you want.
        run_bulk_replay_delete_job.delay(job.id, offset=0, has_seer_data=has_seer_data)

        self.create_audit_entry(
            request,
            organization=project.organization,
            target_object=job.id,
            event=audit_log.get_event_id("REPLAYDELETIONJOBMODEL_START"),
            data={},
        )

        response_data = serialize(job, request.user, ReplayDeletionJobSerializer())
        response = {"data": response_data}

        return Response(response, status=201)


@region_silo_endpoint
class ProjectReplayDeletionJobDetailEndpoint(ProjectReplayEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ReplayDeletionJobPermission,)

    def get(self, request: Request, project, job_id: int) -> Response:
        """
        Fetch a replay delete job instance.
        """
        self.check_replay_access(request, project)

        try:
            job = ReplayDeletionJobModel.objects.get(
                id=job_id, organization_id=project.organization_id, project_id=project.id
            )
        except ReplayDeletionJobModel.DoesNotExist:
            raise ResourceDoesNotExist

        return Response({"data": serialize(job, request.user, ReplayDeletionJobSerializer())})
