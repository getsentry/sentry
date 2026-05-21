from __future__ import annotations

import operator
from collections.abc import Sequence
from functools import reduce

from django.db.models import Exists, OuterRef, Q

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
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactQuerySet,
    PreprodArtifactSizeMetrics,
    PreprodComparisonApproval,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison

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
        "image_count",
        "images_added",
        "images_changed",
        "images_removed",
        "images_renamed",
        "images_skipped",
        "images_unchanged",
        "install_size",
        "state",
    },
    # Keys that support date filtering
    # date_keys={"date_built", "date_added"},
    # Key mappings for user-friendly names
    key_mappings={},
    boolean_keys={
        "installable",
        "is_approved",
    },
    # Allowed search keys
    allowed_keys={
        "app_id",
        "app_name",
        "snapshot_status",
        "build_configuration_name",
        "build_number",
        "build_version",
        "distribution_error_code",
        "download_count",
        "download_size",
        "git_base_ref",
        "git_base_sha",
        "git_head_ref",
        "git_head_sha",
        "git_pr_number",
        "has",
        "image_count",
        "images_added",
        "images_changed",
        "images_removed",
        "images_renamed",
        "images_skipped",
        "images_unchanged",
        "install_size",
        "installable",
        "is",
        "is_approved",
        "platform_name",
        "size_state",
        "state",
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
    "distribution_error_code": "installable_app_error_code",
    "image_count": "preprodsnapshotmetrics__image_count",
    "images_added": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_added",
    "images_changed": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_changed",
    "images_removed": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_removed",
    "images_renamed": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_renamed",
    "images_skipped": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_skipped",
    "images_unchanged": "preprodsnapshotmetrics__snapshot_comparisons_head_metrics__images_unchanged",
    "size_state": "preprodartifactsizemetrics__state",
}

SIZE_STATE_VALUES: dict[str, int] = {
    member.name.lower(): member.value for member in PreprodArtifactSizeMetrics.SizeAnalysisState
}

DISTRIBUTION_ERROR_CODE_VALUES: dict[str, int] = {
    member.name.lower(): member.value for member in PreprodArtifact.InstallableAppErrorCode
}


def _translate_distribution_error_code(value: object) -> int:
    raw = str(value).lower()
    if raw not in DISTRIBUTION_ERROR_CODE_VALUES:
        raise InvalidSearchQuery(
            f"Invalid distribution_error_code value: {value}. "
            f"Valid values: {', '.join(sorted(DISTRIBUTION_ERROR_CODE_VALUES))}"
        )
    return DISTRIBUTION_ERROR_CODE_VALUES[raw]


def _translate_size_state(value: object) -> int:
    raw = str(value).lower()
    if raw not in SIZE_STATE_VALUES:
        raise InvalidSearchQuery(
            f"Invalid size_state value: {value}. "
            f"Valid values: {', '.join(sorted(SIZE_STATE_VALUES))}"
        )
    return SIZE_STATE_VALUES[raw]


SNAPSHOT_STATUS_VALUES = frozenset(
    {
        "approved",
        "auto_approved",
        "base",
        "failed",
        "no_base",
        "pending",
        "processing",
        "requires_approval",
    }
)


def _validate_snapshot_status(value: object) -> str:
    raw = str(value).lower()
    if raw not in SNAPSHOT_STATUS_VALUES:
        raise InvalidSearchQuery(
            f"Invalid status value: {value}. Valid values: {', '.join(sorted(SNAPSHOT_STATUS_VALUES))}"
        )
    return raw


def _base_searchable_queryset() -> PreprodArtifactQuerySet:
    return (
        PreprodArtifact.objects.get_queryset()
        .annotate_download_count()
        .annotate_installable()
        .annotate_main_size_metrics()
        .annotate_platform_name()
    )


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
    search_filters = parse_search_query(query, config=search_config, get_field_type=get_field_type)
    return apply_filters(_base_searchable_queryset(), search_filters, organization)


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

        if name == "size_state":
            values = token.value.value if token.is_in_filter else [token.value.value]
            q = Q(**{f"{db_field}__in": [_translate_size_state(v) for v in values]})
            if token.is_negation:
                queryset = queryset.exclude(q)
            else:
                queryset = queryset.filter(q)
            continue

        if name == "distribution_error_code":
            values = token.value.value if token.is_in_filter else [token.value.value]
            q = Q(**{f"{db_field}__in": [_translate_distribution_error_code(v) for v in values]})
            if token.is_negation:
                queryset = queryset.exclude(q)
            else:
                queryset = queryset.filter(q)
            continue

        if name == "is_approved":
            approved_exists = PreprodComparisonApproval.objects.filter(
                preprod_artifact=OuterRef("pk"),
                preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
                approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            )
            want_approved = bool(token.value.value) ^ token.is_negation
            if want_approved:
                queryset = queryset.filter(Exists(approved_exists))
            else:
                queryset = queryset.filter(~Exists(approved_exists))
            continue

        if name == "snapshot_status":
            values = token.value.value if token.is_in_filter else [token.value.value]
            validated = [_validate_snapshot_status(v) for v in values]

            approval_base_qs = PreprodComparisonApproval.objects.filter(
                preprod_artifact=OuterRef("pk"),
                preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            )
            comparison_exists = PreprodSnapshotComparison.objects.filter(
                head_snapshot_metrics__preprod_artifact=OuterRef("pk"),
            )

            subqueries: list[Q] = []
            for val in validated:
                if val == "base":
                    subqueries.append(
                        Q(preprodsnapshotmetrics__isnull=False)
                        & (
                            Q(commit_comparison__isnull=True)
                            | Q(commit_comparison__base_sha__isnull=True)
                        )
                    )
                elif val == "no_base":
                    subqueries.append(
                        Q(preprodsnapshotmetrics__isnull=False)
                        & Q(commit_comparison__base_sha__isnull=False)
                        & ~Q(Exists(comparison_exists))
                    )
                elif val == "pending":
                    subqueries.append(
                        Q(
                            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.PENDING
                        )
                    )
                elif val == "processing":
                    subqueries.append(
                        Q(
                            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.PROCESSING
                        )
                    )
                elif val == "failed":
                    subqueries.append(
                        Q(
                            preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=PreprodSnapshotComparison.State.FAILED
                        )
                    )
                elif val == "approved":
                    subqueries.append(
                        Q(
                            Exists(
                                approval_base_qs.filter(
                                    approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
                                ).exclude(extras__auto_approval=True)
                            )
                        )
                    )
                elif val == "auto_approved":
                    subqueries.append(
                        Q(
                            Exists(
                                approval_base_qs.filter(
                                    approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
                                    extras__auto_approval=True,
                                )
                            )
                        )
                    )
                elif val == "requires_approval":
                    subqueries.append(
                        Q(
                            Exists(
                                approval_base_qs.exclude(
                                    approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
                                )
                            )
                        )
                    )

            combined = reduce(operator.or_, subqueries)

            if token.is_negation:
                queryset = queryset.filter(~combined)
            else:
                queryset = queryset.filter(combined)
            continue

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
        elif token.operator in ("=", "!="):
            q = Q(**{f"{db_field}__exact": token.value.value})
        else:
            raise InvalidSearchQuery(f"Unknown operator {token.operator}.")

        if token.is_negation or token.operator == "!~":
            q = ~q
        queryset = queryset.filter(q)
    return queryset.distinct()


def get_sequential_base_artifact(
    artifact: PreprodArtifact,
    query: str,
    organization: Organization,
) -> PreprodArtifact | None:
    """
    Find the most recent prior artifact matching the given query and structural
    identity fields, with completed size metrics.

    Used by sequential (n-1) monitors to resolve the base artifact for diff
    comparisons. Unlike the git-based lookup (get_base_artifact_for_commit),
    this orders by date_added rather than commit ancestry.

    Args:
        artifact: The current (head) artifact to find a base for.
        query: The detector's query string (e.g. "app_name:MyApp"). May be empty.
        organization: The organization for scoping query filters.

    Returns:
        The most recent prior PreprodArtifact matching the criteria, or None.
    """
    queryset = _base_searchable_queryset()

    if query and query.strip():
        search_filters = parse_search_query(
            query, config=search_config, get_field_type=get_field_type
        )
        queryset = apply_filters(queryset, search_filters, organization)

    queryset = queryset.filter(
        project_id=artifact.project_id,
        app_id=artifact.app_id,
        artifact_type=artifact.artifact_type,
        build_configuration=artifact.build_configuration,
    )

    queryset = queryset.filter(
        preprodartifactsizemetrics__state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        preprodartifactsizemetrics__metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
    )

    queryset = queryset.exclude(pk=artifact.pk)

    return queryset.order_by("-date_added").first()
