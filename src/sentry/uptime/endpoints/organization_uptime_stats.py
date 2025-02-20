import datetime
import logging
import uuid
from collections import defaultdict

from drf_spectacular.utils import extend_schema
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    Function,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsArgsDict, StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.utils.snuba_rpc import timeseries_rpc

logger = logging.getLogger(__name__)


MAX_UPTIME_SUBSCRIPTION_IDS = 100


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class OrganizationUptimeStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        timerange_args = self._parse_args(request, restrict_rollups=False)
        projects = self.get_projects(request, organization, include_all_accessible=True)

        project_uptime_subscription_ids = request.GET.getlist("projectUptimeSubscriptionId")

        if not project_uptime_subscription_ids:
            return self.respond("No project uptime subscription ids provided", status=400)

        if len(project_uptime_subscription_ids) > MAX_UPTIME_SUBSCRIPTION_IDS:
            return self.respond(
                f"Too many project uptime subscription ids provided. Maximum is {MAX_UPTIME_SUBSCRIPTION_IDS}",
                status=400,
            )

        try:
            subscription_id_to_project_uptime_subscription_id, subscription_ids = (
                self._authorize_and_map_project_uptime_subscription_ids(
                    project_uptime_subscription_ids, projects
                )
            )
        except ValueError:
            return self.respond("Invalid project uptime subscription ids provided", status=400)

        maybe_cutoff = self._get_date_cutoff_epoch_seconds()
        epoch_cutoff = (
            datetime.datetime.fromtimestamp(maybe_cutoff, tz=datetime.UTC) if maybe_cutoff else None
        )

        try:
            eap_response = self._make_eap_request(
                organization, projects, subscription_ids, timerange_args, epoch_cutoff
            )
        except Exception:
            logger.exception("Error making EAP RPC request for uptime check stats")
            return self.respond("error making request", status=400)

        formatted_response = self._format_response(eap_response, epoch_cutoff)

        # Map the response back to project uptime subscription ids
        mapped_response = self._map_response_to_project_uptime_subscription_ids(
            subscription_id_to_project_uptime_subscription_id, formatted_response
        )

        response_with_extra_buckets = add_extra_buckets_for_epoch_cutoff(
            mapped_response,
            epoch_cutoff,
            timerange_args["rollup"],
            timerange_args["start"],
            timerange_args["end"],
        )

        return self.respond(response_with_extra_buckets)

    def _authorize_and_map_project_uptime_subscription_ids(
        self, project_uptime_subscription_ids: list[str], projects: list[Project]
    ) -> tuple[dict[str, int], list[str]]:
        """
        Authorize the project uptime subscription ids and return their corresponding subscription ids
        we don't store the project uptime subscription id in snuba, so we need to map it to the subscription id
        """
        project_uptime_subscription_ids_ints = [int(_id) for _id in project_uptime_subscription_ids]
        project_uptime_subscriptions = ProjectUptimeSubscription.objects.filter(
            project_id__in=[project.id for project in projects],
            id__in=project_uptime_subscription_ids_ints,
        ).values_list("id", "uptime_subscription__subscription_id")

        validated_project_uptime_subscription_ids = {
            project_uptime_subscription[0]
            for project_uptime_subscription in project_uptime_subscriptions
            if project_uptime_subscription[0] is not None
        }
        if set(project_uptime_subscription_ids_ints) != validated_project_uptime_subscription_ids:
            raise ValueError("Invalid project uptime subscription ids provided")

        subscription_id_to_project_uptime_subscription_id = {
            str(uuid.UUID(project_uptime_subscription[1])): project_uptime_subscription[0]
            for project_uptime_subscription in project_uptime_subscriptions
            if project_uptime_subscription[0] is not None
            and project_uptime_subscription[1] is not None
        }

        validated_subscription_ids = [
            project_uptime_subscription[1]
            for project_uptime_subscription in project_uptime_subscriptions
            if project_uptime_subscription[1] is not None
        ]

        return subscription_id_to_project_uptime_subscription_id, validated_subscription_ids

    def _make_eap_request(
        self,
        organization: Organization,
        projects: list[Project],
        subscription_ids: list[str],
        timerange_args: StatsArgsDict,
        epoch_cutoff: datetime.datetime | None,
    ) -> TimeSeriesResponse:

        eap_query_start = timerange_args["start"]
        if epoch_cutoff and epoch_cutoff > timerange_args["start"]:
            eap_query_start = epoch_cutoff

        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(eap_query_start)
        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(timerange_args["end"])
        request = TimeSeriesRequest(
            meta=RequestMeta(
                organization_id=organization.id,
                project_ids=[project.id for project in projects],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
            ),
            aggregations=[
                AttributeAggregation(
                    aggregate=Function.FUNCTION_COUNT,
                    key=AttributeKey(
                        name="uptime_check_id",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    label="count()",
                )
            ],
            group_by=[
                AttributeKey(
                    name="uptime_subscription_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                AttributeKey(
                    name="check_status",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
            ],
            granularity_secs=timerange_args["rollup"],
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(
                        name="uptime_subscription_id",
                        type=AttributeKey.Type.TYPE_STRING,
                    ),
                    op=ComparisonFilter.OP_IN,
                    value=AttributeValue(val_str_array=StrArray(values=subscription_ids)),
                )
            ),
        )
        responses = timeseries_rpc([request])
        assert len(responses) == 1
        return responses[0]

    def _format_response(
        self, response: TimeSeriesResponse, epoch_cutoff: datetime.datetime | None = None
    ) -> dict[str, list[tuple[int, dict[str, int]]]]:
        """
        Formats the response from the EAP RPC request into a dictionary of subscription ids to a list of tuples
        of timestamps and a dictionary of check statuses to counts.
        """
        formatted_data: dict[str, dict[int, dict[str, int]]] = {}

        for timeseries in response.result_timeseries:
            subscription_id = timeseries.group_by_attributes["uptime_subscription_id"]
            status = timeseries.group_by_attributes["check_status"]

            if subscription_id not in formatted_data:
                formatted_data[subscription_id] = defaultdict(
                    lambda: {"failure": 0, "success": 0, "missed_window": 0}
                )

            for bucket, data_point in zip(timeseries.buckets, timeseries.data_points):
                value = int(data_point.data) if data_point.data_present else 0
                formatted_data[subscription_id][bucket.seconds][status] = value

        final_data: dict[str, list[tuple[int, dict[str, int]]]] = {}
        for subscription_id, timestamps in formatted_data.items():
            final_data[subscription_id] = [
                (ts, counts) for ts, counts in sorted(timestamps.items())
            ]

        return final_data

    def _map_response_to_project_uptime_subscription_ids(
        self,
        subscription_id_to_project_uptime_subscription_id: dict[str, int],
        formatted_response: dict[str, list[tuple[int, dict[str, int]]]],
    ) -> dict[int, list[tuple[int, dict[str, int]]]]:
        """
        Map the response back to project uptime subscription ids
        """
        return {
            subscription_id_to_project_uptime_subscription_id[subscription_id]: data
            for subscription_id, data in formatted_response.items()
        }

    def _get_date_cutoff_epoch_seconds(self) -> float | None:
        value = float(options.get("uptime.date_cutoff_epoch_seconds"))
        return None if value == 0 else value


# TODO(jferg): remove after 90 days
def add_extra_buckets_for_epoch_cutoff(
    formatted_response: dict[int, list[tuple[int, dict[str, int]]]],
    epoch_cutoff: datetime.datetime | None,
    rollup: int,
    start: datetime.datetime,
    end: datetime.datetime | None,
) -> dict[int, list[tuple[int, dict[str, int]]]]:
    """
    Add padding buckets to the response to account for the epoch cutoff.
    this is because pre-GA we did not store data.
    """
    if not epoch_cutoff or not formatted_response or epoch_cutoff < start:
        return formatted_response

    end = end or datetime.datetime.now(tz=datetime.UTC)

    # Calculate the number of padding buckets needed.
    total_buckets = int((end.timestamp() - start.timestamp()) / rollup)

    rollup_secs = rollup
    result = {}

    # check the first one and see if it has enough buckets if so return
    # because all of them should have the same number of buckets
    first_result = formatted_response[list(formatted_response.keys())[0]]
    if len(first_result) >= total_buckets:
        return formatted_response
    num_missing = total_buckets - len(first_result)

    # otherwise prepend empty buckets
    for subscription_id, data in formatted_response.items():
        missing_buckets = []
        for i in range(num_missing):
            ts = int(start.timestamp()) + (i * rollup_secs)
            missing_buckets.append((ts, {"failure": 0, "success": 0, "missed_window": 0}))

        result[subscription_id] = missing_buckets + data

    return result
