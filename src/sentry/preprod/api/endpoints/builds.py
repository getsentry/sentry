from collections.abc import Sequence
from typing import Any

from django.db.models import Count, Max, Min, Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    QueryToken,
    SearchConfig,
    SearchFilter,
    parse_search_query,
)
from sentry.api.paginator import OffsetPaginator
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.models import PreprodArtifact

ERR_FEATURE_REQUIRED = "Feature {} is not enabled for the organization."

search_config = SearchConfig.create_from(
    SearchConfig(),
    # Text keys we allow operators to be used on
    # text_operator_keys={"app_id"},
    # Keys that support numeric comparisons
    # numeric_keys={"state", "pr_number"},
    # Keys that support date filtering
    # date_keys={"date_built", "date_added"},
    # Key mappings for user-friendly names
    key_mappings={
        "app_id": ["app_id", "package_name", "bundle_id"],
    },
    # Allowed search keys
    allowed_keys={
        "app_id",
        "package_name",
        "bundle_id",
    },
    # Enable boolean operators
    # allow_boolean=True,
    # Enable wildcard free text search
    # wildcard_free_text=True,
    # Which key we should return any free text under
    free_text_key="text",
)


def apply_filters(
    queryset: BaseQuerySet[PreprodArtifact], filters: Sequence[QueryToken]
) -> BaseQuerySet[PreprodArtifact]:
    for token in filters:
        # Skip operators and other non-filter types
        if isinstance(token, str):  # Handles "AND", "OR" literals
            raise InvalidSearchQuery(f"Boolean operators are not supported: {token}")
        if isinstance(token, AggregateFilter):
            raise InvalidSearchQuery("Aggregate filters are not supported")
        if isinstance(token, ParenExpression):
            raise InvalidSearchQuery("Parenthetical expressions are not supported")

        assert isinstance(token, SearchFilter)

        name = token.key.name

        # We don't currently support free text:
        if name == "text":
            continue

        # We don't have to handle boolean operators or perens here
        # since allow_boolean is not set in SearchConfig.
        d = {}
        if token.is_in_filter:
            d[f"{token.key.name}__in"] = token.value.value
        else:
            d[token.key.name] = token.value.value

        q = Q(**d)
        if token.is_negation:
            q = ~q
        queryset = queryset.filter(q)
    return queryset


@region_silo_endpoint
class BuildsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response(
                {"detail": ERR_FEATURE_REQUIRED.format("organizations:preprod-frontend-routes")},
                status=403,
            )

        on_results = lambda artifacts: [
            transform_preprod_artifact_to_build_details(artifact).dict() for artifact in artifacts
        ]
        paginate = lambda queryset: self.paginate(
            order_by="-date_added",
            request=request,
            queryset=queryset,
            on_results=on_results,
            paginator_cls=OffsetPaginator,
        )

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return paginate(PreprodArtifact.objects.none())

        start = params["start"]
        end = params["end"]
        # Builds don't have environments so we ignore environments from
        # params on purpose.

        queryset = PreprodArtifact.objects.filter(project_id__in=params["project_id"])

        if start:
            queryset = queryset.filter(date_added__gte=start)
        if end:
            queryset = queryset.filter(date_added__lte=end)

        query = request.GET.get("query", "").strip()
        try:
            search_filters = parse_search_query(query, config=search_config)
            queryset = apply_filters(queryset, search_filters)
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        return paginate(queryset)


@region_silo_endpoint
class BuildTagKeyValuesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization, key: str) -> Response:
        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response(
                {"detail": ERR_FEATURE_REQUIRED.format("organizations:preprod-frontend-routes")},
                status=403,
            )

        match key:
            case "bundle_id":
                db_key = "app_id"
            case "package_name":
                db_key = "app_id"
            case _:
                db_key = key

        # We create the same output format as TagValue passed to
        # TagValueSerializer but we don't want to actually use
        # TagValueSerializer since that calls into tagstore.
        def row_to_tag_value(row: dict[str, Any]) -> dict[str, Any]:
            return {
                "count": row["count"],
                "name": key,
                "value": row[db_key],
                "firstSeen": row["first_seen"],
                "lastSeen": row["last_seen"],
            }

        paginate = lambda queryset: self.paginate(
            order_by="-last_seen",
            request=request,
            queryset=queryset,
            on_results=lambda rows: [row_to_tag_value(row) for row in rows],
            paginator_cls=OffsetPaginator,
        )

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            project_id = []
            start = None
            end = None
        else:
            project_id = params["project_id"]
            start = params["start"]
            end = params["end"]
            # Builds don't have environments so we ignore environments from
            # params on purpose.

        queryset = PreprodArtifact.objects.all()
        queryset = queryset.filter(project_id__in=project_id)

        if start:
            queryset = queryset.filter(date_added__gte=start)
        if end:
            queryset = queryset.filter(date_added__lte=end)

        queryset = queryset.values(db_key)
        queryset = queryset.exclude(**{f"{db_key}__isnull": True})
        queryset = queryset.annotate(
            count=Count("*"), first_seen=Min("date_added"), last_seen=Max("date_added")
        )

        return paginate(queryset)
