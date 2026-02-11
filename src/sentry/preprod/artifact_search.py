from __future__ import annotations

from collections.abc import Sequence

from django.db.models import Q

from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    QueryToken,
    SearchConfig,
    SearchFilter,
    parse_search_query,
)
from sentry.db.models.fields.bounded import I64_MAX
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact, PreprodArtifactQuerySet

search_config = SearchConfig.create_from(
    SearchConfig(),
    # Text keys we allow operators to be used on
    text_operator_keys={
        "app_name",
        "build_configuration_name",
        "git_base_ref",
        "git_base_sha",
        "git_head_ref",
        "git_head_sha",
        "platform_name",
    },
    # Keys that support numeric comparisons
    numeric_keys={
        "build_number",
        "download_count",
        "download_size",
        "git_pr_number",
        "install_size",
    },
    # Keys that support date filtering
    # date_keys={"date_built", "date_added"},
    # Key mappings for user-friendly names
    key_mappings={},
    boolean_keys={
        "installable",
    },
    # Allowed search keys
    allowed_keys={
        "app_id",
        "app_name",
        "build_configuration_name",
        "build_number",
        "build_version",
        "download_count",
        "download_size",
        "git_base_ref",
        "git_base_sha",
        "git_head_ref",
        "git_head_sha",
        "git_pr_number",
        "has",
        "install_size",
        "installable",
        "is",
        "platform_name",
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


BYTE_FIELD_KEYS = frozenset({"download_size", "install_size"})


def get_field_type(key: str) -> str | None:
    if key in BYTE_FIELD_KEYS:
        return "byte"
    return None


FIELD_MAPPINGS: dict[str, str] = {
    "app_name": "mobile_app_info__app_name",
    "build_configuration_name": "build_configuration__name",
    "build_number": "mobile_app_info__build_number",
    "build_version": "mobile_app_info__build_version",
    "git_base_ref": "commit_comparison__base_ref",
    "git_base_sha": "commit_comparison__base_sha",
    "git_head_ref": "commit_comparison__head_ref",
    "git_head_sha": "commit_comparison__head_sha",
    "git_pr_number": "commit_comparison__pr_number",
}


def queryset_for_query(
    query: str,
    organization: Organization,
) -> PreprodArtifactQuerySet:
    """
    Create a queryset filtered by the given query string.

    This parses the query string and applies all search filters to a base
    PreprodArtifact queryset with the necessary annotations for filtering.

    Args:
        query: The search query string (e.g., "app_id:foo platform:ios")
        organization: The organization to scope commit_comparison filters to

    Returns:
        A filtered queryset of PreprodArtifact objects

    Raises:
        InvalidSearchQuery: If the query string is invalid
    """
    queryset = PreprodArtifact.objects.get_queryset()
    queryset = queryset.annotate_download_count()
    queryset = queryset.annotate_installable()
    queryset = queryset.annotate_main_size_metrics()
    queryset = queryset.annotate_platform_name()

    search_filters = parse_search_query(query, config=search_config, get_field_type=get_field_type)
    return apply_filters(queryset, search_filters, organization)


def artifact_in_queryset(
    artifact: PreprodArtifact,
    queryset: PreprodArtifactQuerySet,
) -> bool:
    """
    Check if a given PreprodArtifact instance is in the queryset.

    Args:
        artifact: The PreprodArtifact instance to check
        queryset: The queryset to check against

    Returns:
        True if the artifact is in the queryset, False otherwise
    """
    return queryset.filter(pk=artifact.pk).exists()


def artifact_matches_query(
    artifact: PreprodArtifact,
    query: str,
    organization: Organization,
) -> bool:
    """
    Check if a given PreprodArtifact instance matches the query string.

    This combines queryset_for_query() and artifact_in_queryset() to provide
    a convenient way to check if an artifact matches a search query.

    Args:
        artifact: The PreprodArtifact instance to check
        query: The search query string (e.g., "app_id:foo platform:ios")
        organization: The organization to scope commit_comparison filters to

    Returns:
        True if the artifact matches the query, False otherwise

    Raises:
        InvalidSearchQuery: If the query string is invalid
    """
    queryset = queryset_for_query(query, organization)
    return artifact_in_queryset(artifact, queryset)


def apply_filters(
    queryset: PreprodArtifactQuerySet,
    filters: Sequence[QueryToken],
    organization: Organization,
) -> PreprodArtifactQuerySet:
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
                Q(mobile_app_info__app_name__icontains=search_term)
                | Q(app_id__icontains=search_term)
                | Q(mobile_app_info__build_version__icontains=search_term)
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
                search_id = int(search_term)
                # Skip if value exceeds max for BoundedBigIntegerField
                if search_id <= I64_MAX:
                    search_query |= Q(id=search_id)
                    search_query |= Q(
                        commit_comparison__pr_number=search_id,
                        commit_comparison__organization_id=organization.id,
                    )
            queryset = queryset.filter(search_query)
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
