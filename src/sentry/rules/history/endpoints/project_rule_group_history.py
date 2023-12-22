from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, MutableMapping, Sequence, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.issue_alert_examples import IssueAlertExamples
from sentry.apidocs.parameters import GlobalParams, IssueAlertParams
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.history import fetch_rule_groups_paginated
from sentry.rules.history.base import RuleGroupHistory


class RuleGroupHistoryResponse(TypedDict):
    group: BaseGroupSerializerResponse
    count: int
    lastTriggered: datetime
    eventId: str | None


class RuleGroupHistorySerializer(Serializer):
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
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    @extend_schema(
        operation_id="Retrieve a group firing history for an issue alert",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        responses={
            200: RuleGroupHistorySerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.GENERIC_SUCCESS_RESPONSE,
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
