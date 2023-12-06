from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.issue_alert_examples import IssueAlertExamples
from sentry.apidocs.parameters import GlobalParams, IssueAlertParams
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.history import fetch_rule_hourly_stats
from sentry.rules.history.base import TimeSeriesValue


class TimeSeriesValueResponse(TypedDict):
    date: datetime
    count: int


class TimeSeriesValueSerializer(Serializer):
    def serialize(
        self, obj: TimeSeriesValue, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> TimeSeriesValueResponse:
        return {
            "date": obj.bucket,
            "count": obj.count,
        }


@extend_schema(tags=["issue_alerts"])
@region_silo_endpoint
class ProjectRuleStatsIndexEndpoint(RuleEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    @extend_schema(
        operation_id="Retrieve firing starts for an issue alert rule for a given time range. Results are returned in hourly buckets.",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        responses={
            200: TimeSeriesValueSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.GENERIC_SUCCESS_RESPONSE,
    )
    def get(self, request: Request, project: Project, rule: Rule) -> Response:
        start, end = get_date_range_from_params(request.GET)
        results = fetch_rule_hourly_stats(rule, start, end)
        return Response(serialize(results, request.user, TimeSeriesValueSerializer()))
