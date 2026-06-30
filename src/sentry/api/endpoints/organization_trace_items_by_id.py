import logging
import time
import uuid
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any, Literal, Never

import sentry_sdk
from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtoTimestamp
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.project_trace_item_details import (
    convert_rpc_attribute_to_json,
    serialize_item_id,
)
from sentry.api.exceptions import BadRequest
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.snuba_rpc import trace_item_details_rpc

logger = logging.getLogger(__name__)

# Generous window around the supplied timestamp to absorb clock skew and ingestion
# lag. The lookup is keyed by item id, so a wide window only affects scan cost.
_TIMESTAMP_BUFFER = timedelta(days=1)
_MAX_ITEMS = 100

_ItemStatus = Literal["found", "not_found", "error"]
_ItemOutcome = tuple[_ItemStatus, dict[str, Any] | Exception | None]


class _TraceItemSerializer(serializers.Serializer[Never]):
    id = serializers.CharField(required=True)
    traceId = serializers.UUIDField(format="hex", required=True)
    projectId = serializers.IntegerField(required=True)
    timestamp = serializers.DateTimeField(required=False)


class _TraceItemsByIdSerializer(serializers.Serializer[Never]):
    itemType = serializers.ChoiceField([e.value for e in SupportedTraceItemType], required=True)
    columns = serializers.ListField(child=serializers.CharField(), required=True, allow_empty=False)
    items = _TraceItemSerializer(many=True, required=True, allow_empty=False)
    referrer = serializers.CharField(required=False)


class OrganizationTraceItemsByIdPermission(OrganizationPermission):
    # POST here is a read; only org:read is required, not the default org:write.
    scope_map = {"POST": ["org:read", "org:write", "org:admin"]}


@cell_silo_endpoint
class OrganizationTraceItemsByIdEndpoint(OrganizationEndpoint):
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (OrganizationTraceItemsByIdPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization: Organization) -> Response:
        """Fetch specific trace items by id as exact point lookups.

        Unlike a filtered table query, each id is resolved directly so a result
        is never dropped by storage downsampling. Ids that don't resolve are
        returned in `notFoundIds`, and ids whose lookup errored are returned in
        `errorIds`, rather than omitted silently. A single failed lookup never
        fails the whole batch.
        """
        serializer = _TraceItemsByIdSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        item_type = SupportedTraceItemType(data["itemType"])
        trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(item_type)
        if trace_item_type is None:
            raise BadRequest(detail=f"Unsupported trace item type: {item_type.value}")
        columns = data["columns"]
        items = data["items"]
        if len(items) > _MAX_ITEMS:
            return Response(
                {"detail": f"Cannot request more than {_MAX_ITEMS} items at once"}, status=400
            )
        referrer = data.get("referrer", Referrer.API_ORGANIZATION_TRACE_ITEMS_BY_ID.value)

        project_ids = {item["projectId"] for item in items}
        projects_by_id = {
            project.id: project
            for project in self.get_projects(request, organization, project_ids=project_ids)
        }

        include_internal = is_active_superuser(request) or is_active_staff(request)
        include_arrays = features.has(
            "organizations:trace-item-details-array-fields", organization, actor=request.user
        )

        requests_by_id = {
            item["id"]: self._build_request(
                organization, projects_by_id[item["projectId"]], trace_item_type, item, referrer
            )
            for item in items
        }

        outcomes = self._fetch(
            requests_by_id,
            item_type=item_type,
            columns=columns,
            include_internal=include_internal,
            include_arrays=include_arrays,
        )

        rows = []
        not_found_ids = []
        error_ids = []
        sample_error: Exception | None = None
        for item_id, (status, payload) in outcomes.items():
            if status == "found" and isinstance(payload, dict):
                rows.append(payload)
            elif status == "not_found":
                not_found_ids.append(item_id)
            else:
                error_ids.append(item_id)
                if isinstance(payload, Exception):
                    sample_error = payload

        if error_ids:
            logger.warning(
                "trace_items_by_id.partial_failure",
                extra={"errored_item_count": len(error_ids), "organization_id": organization.id},
            )
            if sample_error is not None:
                sentry_sdk.capture_exception(sample_error)

        return Response({"data": rows, "notFoundIds": not_found_ids, "errorIds": error_ids})

    def _build_request(
        self,
        organization: Organization,
        project: Project,
        trace_item_type: TraceItemType.ValueType,
        item: Mapping[str, Any],
        referrer: str,
    ) -> TraceItemDetailsRequest:
        start = ProtoTimestamp()
        end = ProtoTimestamp()
        timestamp = item.get("timestamp")
        if timestamp is not None:
            start.FromDatetime(timestamp - _TIMESTAMP_BUFFER)
            end.FromDatetime(timestamp + _TIMESTAMP_BUFFER)
        else:
            start.FromSeconds(0)
            end.FromSeconds(int(time.time()) + 60 * 60 * 24 * 7)

        return TraceItemDetailsRequest(
            item_id=item["id"],
            trace_id=item["traceId"].hex,
            meta=RequestMeta(
                organization_id=organization.id,
                cogs_category="events_analytics_platform",
                referrer=referrer,
                project_ids=[project.id],
                start_timestamp=start,
                end_timestamp=end,
                trace_item_type=trace_item_type,
                request_id=str(uuid.uuid4()),
            ),
        )

    def _fetch(
        self,
        requests_by_id: Mapping[str, TraceItemDetailsRequest],
        *,
        item_type: SupportedTraceItemType,
        columns: Sequence[str],
        include_internal: bool,
        include_arrays: bool,
    ) -> dict[str, _ItemOutcome]:
        def run(req: TraceItemDetailsRequest) -> _ItemOutcome:
            try:
                response = MessageToDict(trace_item_details_rpc(req))
                return (
                    "found",
                    self._serialize_row(
                        response, item_type, columns, include_internal, include_arrays
                    ),
                )
            except NotFound:
                return ("not_found", None)
            except Exception as error:
                return ("error", error)

        item_ids = list(requests_by_id.keys())
        with ContextPropagatingThreadPoolExecutor(max_workers=10) as pool:
            results = pool.map(run, (requests_by_id[item_id] for item_id in item_ids))
        return dict(zip(item_ids, results))

    def _serialize_row(
        self,
        response: Mapping[str, Any],
        item_type: SupportedTraceItemType,
        fields: Sequence[str],
        include_internal: bool,
        include_arrays: bool,
    ) -> dict[str, Any]:
        attributes = convert_rpc_attribute_to_json(
            response.get("attributes", []),
            item_type,
            include_internal=include_internal,
            include_arrays=include_arrays,
        )
        values_by_name = {attribute["name"]: attribute["value"] for attribute in attributes}
        values_by_name.setdefault("id", serialize_item_id(response["itemId"], item_type))
        return {field: values_by_name.get(field) for field in fields}
