from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, MutableMapping, Sequence, TypedDict

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GLOBAL_PARAMS, ISSUE_ALERT_PARAMS
from sentry.models import Project, Rule
from sentry.rules.history import fetch_rule_groups_paginated
from sentry.rules.history.base import RuleGroupHistory


class RuleGroupHistoryResponse(TypedDict):
    group: BaseGroupSerializerResponse
    count: int
    lastTriggered: datetime
    eventId: str | None


class RuleGroupHistorySerializer(Serializer):  # type: ignore
    def get_attrs(
        self, item_list: Sequence[RuleGroupHistory], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        serialized_groups = {
            g["id"]: g for g in serialize([item.group for item in item_list], user)
        }
        return {
            history: {"group": serialized_groups[str(history.group.id)]} for history in item_list
        }

    def serialize(
        self, obj: RuleGroupHistory, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> RuleGroupHistoryResponse:
        return {
            "group": attrs["group"],
            "count": obj.count,
            "lastTriggered": obj.last_triggered,
            "eventId": obj.event_id,
        }


@extend_schema(tags=["issue_alerts"])
@region_silo_endpoint
class ProjectRuleGroupHistoryIndexEndpoint(RuleEndpoint):
    @extend_schema(
        operation_id="Retrieve a group firing history for an issue alert",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, GLOBAL_PARAMS.PROJECT_SLUG, ISSUE_ALERT_PARAMS],
        responses={
            200: RuleGroupHistorySerializer,
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
        per_page = self.get_per_page(request)
        cursor = self.get_cursor_from_request(request)
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams:
            raise ParseError(detail="Invalid start and end dates")

        results = fetch_rule_groups_paginated(rule, start, end, cursor, per_page)

        response = Response(serialize(results.results, request.user, RuleGroupHistorySerializer()))
        self.add_cursor_headers(request, response, results)
        return response
