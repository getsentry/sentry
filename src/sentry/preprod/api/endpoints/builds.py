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
ERR_BAD_KEY = "Key {} is unknown."

search_config = SearchConfig.create_from(
    SearchConfig(),
    # Text keys we allow operators to be used on
    text_operator_keys={"branch", "repo", "sha", "base_sha"},
    # Keys that support numeric comparisons
    numeric_keys={"download_count", "build_number", "download_size", "install_size", "pr_number"},
    # Keys that support date filtering
    # date_keys={"date_built", "date_added"},
    # Key mappings for user-friendly names
    key_mappings={
        "app_id": ["package_name", "bundle_id"],
    },
    boolean_keys={
        "installable",
    },
    # Allowed search keys
    allowed_keys={
        "app_id",
        "package_name",
        "bundle_id",
        "download_count",
        "build_version",
        "build_number",
        "download_size",
        "install_size",
        "build_configuration",
        "branch",
        "is",
        "has",
        "platform",
        "repo",
        "pr_number",
        "sha",
        "base_sha",
        "installable",
    },
    # Enable boolean operators
    # allow_boolean=True,
    # Enable wildcard free text search
    # wildcard_free_text=True,
    # Which key we should return any free text under
    free_text_key="text",
    # is:foo filters
    is_filter_translation={
        "installable": ("installable", True),
    },
)


def get_field_type(key: str) -> str | None:
    match key:
        case "download_size":
            return "byte"
        case "install_size":
            return "byte"
        case _:
            return None


FIELD_MAPPINGS: dict[str, str] = {
    "branch": "commit_comparison__head_ref",
    "repo": "commit_comparison__head_repo_name",
    "pr_number": "commit_comparison__pr_number",
    "sha": "commit_comparison__head_sha",
    "base_sha": "commit_comparison__base_sha",
    "build_configuration": "build_configuration__name",
    "bundle_id": "app_id",
    "package_name": "app_id",
}

# Platform values map to artifact_type
PLATFORM_TO_ARTIFACT_TYPES: dict[str, list[int]] = {
    "ios": [PreprodArtifact.ArtifactType.XCARCHIVE],
    "android": [PreprodArtifact.ArtifactType.AAB, PreprodArtifact.ArtifactType.APK],
}


def apply_filters(
    queryset: BaseQuerySet[PreprodArtifact],
    filters: Sequence[QueryToken],
    organization: Organization,
) -> BaseQuerySet[PreprodArtifact]:
    for token in filters:
        # Skip operators and other non-filter types
        if isinstance(token, str):  # Handles "AND", "OR" literals
            raise InvalidSearchQuery(f"Boolean operators are not supported: {token}")
        if isinstance(token, ParenExpression):
            raise InvalidSearchQuery("Parenthetical expressions are not supported")
        if isinstance(token, AggregateFilter):
            raise InvalidSearchQuery("Aggregate filters are not supported")

        assert isinstance(token, SearchFilter)

        name = token.key.name

        # Handle free text search
        if name == "text":
            search_term = str(token.value.value).strip()
            if not search_term:
                continue

            search_query = (
                Q(app_name__icontains=search_term)
                | Q(app_id__icontains=search_term)
                | Q(build_version__icontains=search_term)
                | Q(
                    commit_comparison__head_sha__icontains=search_term,
                    commit_comparison__organization_id=organization.id,
                )
                | Q(
                    commit_comparison__head_ref__icontains=search_term,
                    commit_comparison__organization_id=organization.id,
                )
            )

            if search_term.isdigit():
                search_query |= Q(
                    commit_comparison__pr_number=int(search_term),
                    commit_comparison__organization_id=organization.id,
                )
            queryset = queryset.filter(search_query)
            continue

        if name == "platform":
            value = token.value.value
            # Handle "in" operator where value is a list
            if isinstance(value, list):
                all_artifact_types = []
                for platform_value in value:
                    platform_lower = (
                        platform_value.lower()
                        if isinstance(platform_value, str)
                        else platform_value
                    )
                    artifact_types = PLATFORM_TO_ARTIFACT_TYPES.get(platform_lower)
                    if artifact_types is None:
                        raise InvalidSearchQuery(
                            f"Invalid platform value: {platform_lower}. Valid values are: ios, android"
                        )
                    all_artifact_types.extend(artifact_types)
                q = Q(artifact_type__in=all_artifact_types)
            else:
                # Handle single value (equals or not equals)
                if isinstance(value, str):
                    value = value.lower()
                artifact_types = PLATFORM_TO_ARTIFACT_TYPES.get(value)
                if artifact_types is None:
                    raise InvalidSearchQuery(
                        f"Invalid platform value: {value}. Valid values are: ios, android"
                    )
                q = Q(artifact_type__in=artifact_types)
            if token.is_negation:
                q = ~q
            queryset = queryset.filter(q)
            continue

        db_field = FIELD_MAPPINGS.get(name, name)

        # We don't have to handle boolean operators or parens here
        # since allow_boolean is not set in SearchConfig.
        if token.is_in_filter:
            q = Q(**{f"{db_field}__in": token.value.value})
        elif token.value.is_wildcard():
            q = Q(**{f"{db_field}__regex": token.value.value})
        elif token.operator == ">":
            q = Q(**{f"{db_field}__gt": token.value.value})
        elif token.operator == "<":
            q = Q(**{f"{db_field}__lt": token.value.value})
        elif token.operator == ">=":
            q = Q(**{f"{db_field}__gte": token.value.value})
        elif token.operator == "<=":
            q = Q(**{f"{db_field}__lte": token.value.value})
        elif token.operator == "~":
            q = Q(**{f"{db_field}__icontains": token.value.value})
        elif token.operator == "=" and token.value.value == "":
            # has: filter - this ends up negated by is_negation below.
            q = Q(**{f"{db_field}__isnull": False})
        elif token.operator == "!=" and token.value.value == "":
            # !has: filter
            q = Q(**{f"{db_field}__isnull": False})
        elif token.operator == "=":
            q = Q(**{f"{db_field}__exact": token.value.value})
        elif token.operator == "!=":
            # Negation handled below (is_negation handles !=)
            q = Q(**{f"{db_field}__exact": token.value.value})
        else:
            raise InvalidSearchQuery(f"Unknown operator {token.operator}.")

        if token.is_negation or token.operator == "!~":
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

        queryset = queryset.annotate_download_count()  # type: ignore[attr-defined]
        queryset = queryset.annotate_installable()
        queryset = queryset.annotate_main_size_metrics()

        query = request.GET.get("query", "").strip()
        try:
            search_filters = parse_search_query(
                query, config=search_config, get_field_type=get_field_type
            )
            queryset = apply_filters(queryset, search_filters, organization)
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

        if key not in search_config.allowed_keys:
            return Response(
                {"detail": ERR_BAD_KEY.format(key)},
                status=400,
            )

        # Some keys are synthetic/computed and don't have tag values
        if key in ("is", "platform"):
            return Response(
                {"detail": f"Key {key} does not support tag value lookups."},
                status=400,
            )

        db_key = FIELD_MAPPINGS.get(key, key)

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
        queryset = queryset.annotate_download_count()
        queryset = queryset.annotate_installable()
        queryset = queryset.annotate_main_size_metrics()
        queryset = queryset.annotate(
            count=Count("*"), first_seen=Min("date_added"), last_seen=Max("date_added")
        )

        return paginate(queryset)
