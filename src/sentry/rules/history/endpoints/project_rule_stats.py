from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, TypedDict

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GLOBAL_PARAMS, ISSUE_ALERT_PARAMS
from sentry.models import Project, Rule
from sentry.rules.history import fetch_rule_hourly_stats
from sentry.rules.history.base import TimeSeriesValue


class TimeSeriesValueResponse(TypedDict):
    date: datetime
    count: int


class TimeSeriesValueSerializer(Serializer):  # type: ignore
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
    @extend_schema(
        operation_id="Retrieve firing starts for an issue alert rule for a given time range. Results are returned in hourly buckets.",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, GLOBAL_PARAMS.PROJECT_SLUG, ISSUE_ALERT_PARAMS],
        responses={
            200: TimeSeriesValueSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[
            OpenApiExample(
                "Successful response",
                value={},
                status_codes=["200"],
            )
        ],
    )
    def get(self, request: Request, project: Project, rule: Rule) -> Response:
        start, end = get_date_range_from_params(request.GET)
        results = fetch_rule_hourly_stats(rule, start, end)
        return Response(serialize(results, request.user, TimeSeriesValueSerializer()))
