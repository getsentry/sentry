import uuid
from collections.abc import MutableMapping
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Limit, Offset, Op, Query

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.lib.eap.read import query
from sentry.replays.lib.eap.snuba_transpiler import RequestMeta, Settings
from sentry.replays.lib.paginator import HasMorePaginator

settings: Settings = {
    "attribute_types": {
        # Common
        "replay_id": str,
        "category": str,
        "duration": float,
        "url": str,
        "size": float,
        # Memory
        "jsHeapSizeLimit": int,
        "totalJSHeapSize": int,
        "usedJSHeapSize": int,
        "endTimestamp": float,
        # SDK Options
        "shouldRecordCanvas": bool,
        "useCompressionOption": bool,
        "blockAllMedia": bool,
        "maskAllText": bool,
        "maskAllInputs": bool,
        "useCompression": bool,
        "networkDetailHasUrls": bool,
        "networkCaptureBodies": bool,
        "networkRequestHasHeaders": bool,
        "networkResponseHasHeaders": bool,
        "sessionSampleRate": float,
        "errorSampleRate": float,
        # Mutations
        "count": int,
        # Web vitals
        "rating": str,
        "value": float,
        # Resource
        "statusCode": int,
        "decodedBodySize": int,
        "encodedBodySize": int,
        # Resource Fetch
        "method": str,
        "statusCode": int,
        "request_size": int,
        "response_size": int,
        # Navigation
        "from": str,
        "to": str,
        # Click
        "node_id": int,
        "tag": str,
        "text": str,
        "is_dead": bool,
        "is_rage": bool,
        "selector": str,
        "alt": str,
        "aria_label": str,
        "component_name": str,
        "class": str,
        "id": str,
        "role": str,
        "title": str,
        "testid": str,
    },
    "default_limit": 50,
    "default_offset": 0,
    "extrapolation_mode": "none",
}


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayBreadcrumbsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        filter_params = self.get_filter_params(request, project)

        def data_fn(offset: int, limit: int):
            request_meta: RequestMeta = {
                "cogs_category": "replay",
                "debug": False,
                "end_datetime": filter_params["end"],
                "organization_id": project.organization_id,
                "project_ids": [project.id],
                "referrer": "replays.details.breadcrumbs.list",
                "request_id": uuid.uuid4().hex,
                "start_datetime": filter_params["start"],
                "trace_item_type": "replay",
            }

            snuba_query = Query(
                match=Entity("trace_items"),
                select=[Column(k) for k in settings["attribute_types"].keys()],
                where=[Condition(Column("replay_id"), Op.EQ, replay_id)],
                limit=Limit(limit),
                offset=Offset(offset),
            )

            return query(snuba_query, settings, request_meta, virtual_columns=[])

        return self.paginate(request=request, paginator=HasMorePaginator(data_fn=data_fn))


class Event(TypedDict):
    id: str
    type: str
    attributes: MutableMapping[str, bool | float | int | str | None]


class MemoryAttributes(TypedDict):
    jsHeapSizeLimit: int
    totalJSHeapSize: int
    usedJSHeapSize: int
    endTimestamp: float
    duration: float


class SDKOptionsAttributes(TypedDict):
    shouldRecordCanvas: bool
    useCompressionOption: bool
    blockAllMedia: bool
    maskAllText: bool
    maskAllInputs: bool
    useCompression: bool
    networkDetailHasUrls: bool
    networkCaptureBodies: bool
    networkRequestHasHeaders: bool
    networkResponseHasHeaders: bool
    sessionSampleRate: float
    errorSampleRate: float


class MutationAttributes(TypedDict):
    count: int


class WebVitalAttributes(TypedDict):
    url: str
    size: float
    rating: str
    value: float


class ResourceAttributes(TypedDict):
    method: str
    statusCode: int
    request_size: int
    response_size: int


NavigationAttributes = TypedDict(
    "NavigationAttributes",
    {
        "from": str,
        "to": str,
    },
)

ClickAttributes = TypedDict(
    "ClickAttributes",
    {
        "node_id": int,
        "tag": str,
        "text": str,
        "is_dead": bool,
        "is_rage": bool,
        "selector": str,
        "alt": str,
        "aria_label": str,
        "component_name": str,
        "class": str,
        "id": str,
        "role": str,
        "title": str,
        "testid": str,
    },
)
