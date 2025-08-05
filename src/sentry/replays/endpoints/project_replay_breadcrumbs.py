from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayBreadcrumbsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        import datetime
        import uuid

        from sentry.replays.lib.eap.read import query
        from sentry.replays.lib.eap.snuba_transpiler import RequestMeta, Settings

        settings: Settings = {
            "attribute_types": {"abc": str, "def": int},
            "default_limit": 50,
            "default_offset": 0,
            "extrapolation_mode": "none",
        }

        request_meta: RequestMeta = {
            "cogs_category": "replay",
            "debug": False,
            "end_datetime": datetime.datetime.now(),
            "organization_id": project.organization.id,
            "project_ids": [project.id],
            "referrer": "replays.details.breadcrumbs.list",
            "request_id": uuid.uuid4().hex,
            "start_datetime": datetime.datetime.now() - datetime.timedelta(days=90),
            "trace_item_type": "replay",
        }

        from snuba_sdk import Column, Condition, Entity, Function, Query

        snuba_query = Query(
            match=Entity("trace_items"),
            select=[Column("abc"), Column("def")],
            limit=100,
        )

        response = query(snuba_query, settings, request_meta, virtual_columns=[])
        raise Exception(response)

    # def get(self, request: Request, project: Project, replay_id: str) -> Response:
    #     if not features.has(
    #         "organizations:session-replay", project.organization, actor=request.user
    #     ):
    #         return Response(status=404)

    #     filter_params = self.get_filter_params(request, project)

    #     try:
    #         replay_id = str(uuid.UUID(replay_id))
    #     except ValueError:
    #         return Response(status=404)

    #     snuba_response = query_replay_instance(
    #         project_id=project.id,
    #         replay_id=replay_id,
    #         start=filter_params["start"],
    #         end=filter_params["end"],
    #         organization=project.organization,
    #         request_user_id=request.user.id,
    #     )

    #     response = process_raw_response(
    #         snuba_response,
    #         fields=request.query_params.getlist("field"),
    #     )

    #     if len(response) == 0:
    #         return Response(status=404)
    #     else:
    #         return Response({"data": response[0]}, status=200)
    #         return Response({"data": response[0]}, status=200)
