from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.exceptions import InvalidParams
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers import (
    WorkflowGroupHistory,
    WorkflowGroupHistorySerializer,
)
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime
    event_id: str


def convert_results(results: Sequence[_Result]) -> Sequence[WorkflowGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}
    return [
        WorkflowGroupHistory(
            group_lookup[r["group"]], r["count"], r["last_triggered"], r["event_id"]
        )
        for r in results
    ]


def fetch_workflow_groups_paginated(
    workflow: Workflow,
    start: datetime,
    end: datetime,
    cursor: Cursor | None = None,
    per_page: int = 25,
) -> CursorResult[Group]:
    filtered_history = WorkflowFireHistory.objects.filter(
        workflow=workflow,
        date_added__gte=start,
        date_added__lt=end,
    )

    # subquery that retrieves row with the largest date in a group
    group_max_dates = filtered_history.filter(group=OuterRef("group")).order_by("-date_added")[:1]
    qs = (
        filtered_history.select_related("group")
        .values("group")
        .annotate(count=Count("group"))
        .annotate(event_id=Subquery(group_max_dates.values("event_id")))
        .annotate(last_triggered=Max("date_added"))
    )

    return cast(
        CursorResult[Group],
        OffsetPaginator(
            qs, order_by=("-count", "-last_triggered"), on_results=convert_results
        ).get_result(per_page, cursor),
    )


@region_silo_endpoint
class OrganizationWorkflowGroupHistoryEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Retrieve Group Firing History for a Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            200: WorkflowGroupHistorySerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        per_page = self.get_per_page(request)
        cursor = self.get_cursor_from_request(request)
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams:
            raise ParseError(detail="Invalid start and end dates")

        results = fetch_workflow_groups_paginated(workflow, start, end, cursor, per_page)

        response = Response(
            serialize(results.results, request.user, WorkflowGroupHistorySerializer())
        )
        self.add_cursor_headers(request, response, results)
        return response
