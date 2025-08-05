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
            "attribute_types": {"abc": str, "def": int, "xyz": float},
            "default_limit": 50,
            "default_offset": 0,
            "extrapolation_mode": "none",
        }

        request_meta: RequestMeta = {
            "cogs_category": "replay",
            "debug": False,
            "end_datetime": datetime.datetime.now() + datetime.timedelta(days=90),
            "organization_id": project.organization.id,
            "project_ids": [project.id],
            "referrer": "replays.details.breadcrumbs.list",
            "request_id": uuid.uuid4().hex,
            "start_datetime": datetime.datetime.now() - datetime.timedelta(days=90),
            "trace_item_type": "replay",
        }

        from snuba_sdk import Column, Condition, Direction, Entity, Function, OrderBy, Query

        snuba_query = Query(
            match=Entity("trace_items"),
            select=[Column("abc"), Column("def"), Column("xyz")],
            orderby=[OrderBy(Column("abc"), direction=Direction.ASC)],
        )
        response = query(snuba_query, settings, request_meta, virtual_columns=[])
        return Response(response, status=200)
