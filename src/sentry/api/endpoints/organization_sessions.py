from contextlib import contextmanager

import sentry_sdk
from django.utils.datastructures import MultiValueDict
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import release_health
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.models import Organization
from sentry.snuba.sessions_v2 import SNUBA_LIMIT, InvalidField, InvalidParams, QueryDefinition
from sentry.utils.cursors import Cursor, CursorResult


# NOTE: this currently extends `OrganizationEventsEndpointBase` for `handle_query_errors` only, which should ideally be decoupled from the base class.
class OrganizationSessionsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        def data_fn(offset: int, limit: int):
            with self.handle_query_errors():
                with sentry_sdk.start_span(
                    op="sessions.endpoint", description="build_sessions_query"
                ):
                    query = self.build_sessions_query(
                        request, organization, offset=offset, limit=limit
                    )

                return release_health.run_sessions_query(
                    organization.id, query, span_op="sessions.endpoint"
                )

        return self.paginate(
            request,
            paginator=SessionsDataSeriesPaginator(data_fn=data_fn),
            default_per_page=SNUBA_LIMIT,
            max_per_page=SNUBA_LIMIT,
        )

    def build_sessions_query(
        self, request: Request, organization: Organization, offset: int, limit: int
    ):
        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            raise NoProjects("No projects available")  # give it a description

        # HACK to prevent front-end crash when release health is sessions-based:
        query_params = MultiValueDict(request.GET)
        if not release_health.is_metrics_based() and request.GET.get("interval") == "10s":
            query_params["interval"] = "1m"

        start, _ = get_date_range_from_params(query_params)
        query_config = release_health.sessions_query_config(organization, start)

        return QueryDefinition(
            query_params,
            params,
            offset=offset,
            limit=limit,
            query_config=query_config,
        )

    @contextmanager
    def handle_query_errors(self):
        try:
            # TODO: this context manager should be decoupled from `OrganizationEventsEndpointBase`?
            with super().handle_query_errors():
                yield
        except (InvalidField, InvalidParams, NoProjects) as error:
            raise ParseError(detail=str(error))


class SessionsDataSeriesPaginator(GenericOffsetPaginator):
    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        data = self.data_fn(offset=offset, limit=limit + 1)

        if isinstance(data.get("groups"), list):
            has_more = len(data["groups"]) == limit + 1
            if has_more:
                data["groups"].pop()
        else:
            raise NotImplementedError

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
