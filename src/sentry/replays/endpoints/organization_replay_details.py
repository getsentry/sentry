import uuid
from datetime import datetime

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams, ReplayParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.models.organization import Organization
from sentry.replays.lib.eap import read as eap_read
from sentry.replays.lib.eap.snuba_transpiler import RequestMeta, Settings
from sentry.replays.post_process import ReplayDetailsResponse, process_raw_response
from sentry.replays.query import query_replay_instance
from sentry.replays.validators import ReplayValidator


def query_replay_instance_eap(
    project_ids: list[int],
    replay_ids: list[str],
    start: datetime,
    end: datetime,
    organization_id: int,
    request_user_id: int | None,
    referrer: str = "replays.query.details_query",
):
    # EAP stores replay_id in hex without dashes
    replay_ids_no_dashes = [replay_id.replace("-", "") for replay_id in replay_ids]

    select = [
        Column("replay_id"),
        Function("min", parameters=[Column("project_id")], alias="agg_project_id"),
        Function("min", parameters=[Column("replay_start_timestamp")], alias="started_at"),
        Function("max", parameters=[Column("timestamp")], alias="finished_at"),
        Function("count", parameters=[Column("segment_id")], alias="count_segments"),
        Function("sum", parameters=[Column("count_error_events")], alias="count_errors"),
        Function("sum", parameters=[Column("count_warning_events")], alias="count_warnings"),
        Function("sum", parameters=[Column("count_info_events")], alias="count_infos"),
        Function(
            "sumIf",
            parameters=[
                Column("click_is_dead"),
                Function(
                    "greaterOrEquals",
                    [Column("timestamp"), int(datetime(year=2023, month=7, day=24).timestamp())],
                ),
            ],
            alias="count_dead_clicks",
        ),
        Function(
            "sumIf",
            parameters=[
                Column("click_is_rage"),
                Function(
                    "greaterOrEquals",
                    [Column("timestamp"), int(datetime(year=2023, month=7, day=24).timestamp())],
                ),
            ],
            alias="count_rage_clicks",
        ),
        Function("max", parameters=[Column("is_archived")], alias="isArchived"),
    ]

    snuba_query = Query(
        match=Entity("replays"),
        select=select,
        where=[
            Condition(Column("replay_id"), Op.IN, replay_ids_no_dashes),
        ],
        groupby=[Column("replay_id")],
        granularity=Granularity(3600),
    )

    settings = Settings(
        attribute_types={
            "replay_id": str,
            "project_id": int,
            "timestamp": int,
            "replay_start_timestamp": int,
            "segment_id": int,
            "is_archived": int,
            "count_error_events": int,
            "count_warning_events": int,
            "count_info_events": int,
            "click_is_dead": int,
            "click_is_rage": int,
        },
        default_limit=100,
        default_offset=0,
    )

    request_meta = RequestMeta(
        cogs_category="replays",
        debug=False,
        start_datetime=start,
        end_datetime=end,
        organization_id=organization_id,
        project_ids=project_ids,
        referrer=referrer,
        request_id=str(uuid.uuid4().hex),
        trace_item_type="replay",
    )
    return eap_read.query(snuba_query, settings, request_meta, [])


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class OrganizationReplayDetailsEndpoint(OrganizationEndpoint):
    """
    The same data as ProjectReplayDetails, except no project is required.
    This works as we'll query for this replay_id across all projects in the
    organization that the user has access to.
    """

    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Replay Instance",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReplayParams.REPLAY_ID, ReplayValidator],
        responses={
            200: inline_sentry_response_serializer("GetReplay", ReplayDetailsResponse),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_DETAILS,
    )
    def get(self, request: Request, organization: Organization, replay_id: str) -> Response:
        """
        Return details on an individual replay.
        """
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            filter_params = self.get_filter_params(
                request, organization, project_ids=ALL_ACCESS_PROJECTS
            )
        except NoProjects:
            return Response(status=404)

        if not filter_params["start"] or not filter_params["end"]:
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        projects = self.get_projects(request, organization, include_all_accessible=True)
        project_ids = [project.id for project in projects]

        # Use EAP query if feature flag is enabled
        if features.has("organizations:replay-details-eap-query", organization, actor=request.user):
            snuba_response = query_replay_instance_eap(
                project_ids=project_ids,
                replay_ids=[replay_id],
                start=filter_params["start"],
                end=filter_params["end"],
                organization_id=organization.id,
                request_user_id=request.user.id,
            )["data"]
        else:
            snuba_response = query_replay_instance(
                project_id=project_ids,
                replay_id=replay_id,
                start=filter_params["start"],
                end=filter_params["end"],
                organization=organization,
                request_user_id=request.user.id,
            )

        response = process_raw_response(
            snuba_response,
            fields=request.query_params.getlist("field"),
        )

        if len(response) == 0:
            return Response(status=404)
        else:
            return Response({"data": response[0]}, status=200)
