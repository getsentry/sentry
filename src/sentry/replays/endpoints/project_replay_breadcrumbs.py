import uuid
from collections.abc import Callable, MutableMapping, Sequence
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Limit, Offset, Op, Query

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.lib.eap.read import query
from sentry.replays.lib.eap.snuba_transpiler import RequestMeta, Settings
from sentry.utils.cursors import Cursor, CursorResult

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
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        filter_params = self.get_filter_params(request, project)
        end, start = filter_params["end"], filter_params["start"]

        def data_fn(offset: int, limit: int):
            request_meta: RequestMeta = {
                "cogs_category": "replay",
                "debug": False,
                "end_datetime": end,
                "organization_id": project.organization_id,
                "project_ids": [project.id],
                "referrer": "replays.details.breadcrumbs.list",
                "request_id": uuid.uuid4().hex,
                "start_datetime": start,
                "trace_item_type": "replay",
            }

            snuba_query = Query(
                match=Entity("trace_items"),
                select=[Column(k) for k in settings["attribute_types"].keys()],
                where=[Condition(Column("replay_id"), Op.EQ, replay_id)],
                limit=Limit(limit),
                offset=Offset(offset),
            )

            results = query(snuba_query, settings, request_meta, virtual_columns=[])
            return [subset_event(item) for item in results["data"]]

        return self.paginate(
            request=request,
            paginator=HasMorePaginator(data_fn=data_fn),
            on_results=lambda results: {"data": results},
        )


class Event(TypedDict):
    id: str
    type: str
    attributes: MutableMapping[str, bool | float | int | str | None]


CATEGORY_ATTRIBUTE_MAP = {
    "ui.click": [
        "node_id",
        "tag",
        "text",
        "is_dead",
        "is_rage",
        "selector",
        "alt",
        "aria_label",
        "component_name",
        "class",
        "id",
        "role",
        "title",
        "testid",
    ],
    "navigation": ["from", "to"],
    "resource.xhr": [
        "url",
        "method",
        "duration",
        "statusCode",
        "request_size",
        "response_size",
    ],
    "resource.fetch": [
        "url",
        "method",
        "duration",
        "statusCode",
        "request_size",
        "response_size",
    ],
    "resource.script": [
        "url",
        "duration",
        "size",
        "statusCode",
        "decodedBodySize",
        "encodedBodySize",
    ],
    "resource.img": [
        "url",
        "duration",
        "size",
        "statusCode",
        "decodedBodySize",
        "encodedBodySize",
    ],
    "web-vital.cls": ["duration", "rating", "size", "value"],
    "web-vital.fcp": ["duration", "rating", "size", "value"],
    "web-vital.lcp": ["duration", "rating", "size", "value"],
    "replay.hydrate-error": ["url"],
    "replay.mutations": ["count"],
    "sdk.options": [
        "shouldRecordCanvas",
        "useCompressionOption",
        "blockAllMedia",
        "maskAllText",
        "maskAllInputs",
        "useCompression",
        "networkDetailHasUrls",
        "networkCaptureBodies",
        "networkRequestHasHeaders",
        "networkResponseHasHeaders",
        "sessionSampleRate",
        "errorSampleRate",
    ],
    "memory": ["jsHeapSizeLimit", "totalJSHeapSize", "usedJSHeapSize", "endTimestamp", "duration"],
}


def subset_event(source: MutableMapping[str, bool | float | int | str | None]) -> Event:
    return {
        "id": "None",
        "type": str(source["category"]),
        "attributes": subset_of(source, CATEGORY_ATTRIBUTE_MAP[str(source["category"])]),
    }


def subset_of(
    source: MutableMapping[str, bool | float | int | str | None],
    keys: Sequence[str],
) -> MutableMapping[str, bool | float | int | str | None]:
    return {key: source[key] for key in keys}


class HasMorePaginator:
    """Returns a next cursor if the limit plus one was met."""

    def __init__(
        self,
        data_fn: Callable[[int, int], list[Event]],
    ) -> None:
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor=None):
        assert limit > 0
        offset = int(cursor.offset) if cursor is not None else 0
        response = self.data_fn(offset, limit + 1)

        has_more = len(response) > limit
        if has_more:
            response.pop()

        return CursorResult(
            response,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
