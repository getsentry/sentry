from datetime import datetime
from typing import Any, Callable, Mapping, MutableMapping, Optional, Sequence, Tuple

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, search
from sentry.api.event_search import SearchFilter
from sentry.api.issue_search import convert_query_values, parse_search_query
from sentry.api.serializers import serialize
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Environment, Group, Organization, Project, Release, User
from sentry.models.group import looks_like_short_id
from sentry.signals import advanced_search_feature_gated
from sentry.utils import metrics
from sentry.utils.cursors import Cursor, CursorResult

from . import SEARCH_MAX_HITS
from .validators import ValidationError

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
EndpointFunction = Callable[..., Response]


# List of conditions that mark a SearchFilter as an advanced search. Format is
# (lambda SearchFilter(): <boolean condition>, '<feature_name')
advanced_search_features: Sequence[Tuple[Callable[[SearchFilter], Any], str]] = [
    (lambda search_filter: search_filter.is_negation, "negative search"),
    (lambda search_filter: search_filter.value.is_wildcard(), "wildcard search"),
]


def build_query_params_from_request(
    request: Request,
    organization: "Organization",
    projects: Sequence["Project"],
    environments: Optional[Sequence["Environment"]],
) -> MutableMapping[str, Any]:
    query_kwargs = {"projects": projects, "sort_by": request.GET.get("sort", DEFAULT_SORT_OPTION)}

    limit = request.GET.get("limit")
    if limit:
        try:
            query_kwargs["limit"] = int(limit)
        except ValueError:
            raise ValidationError("invalid limit")

    # TODO: proper pagination support
    if request.GET.get("cursor"):
        try:
            query_kwargs["cursor"] = Cursor.from_string(request.GET.get("cursor"))
        except ValueError:
            raise ParseError(detail="Invalid cursor parameter.")
    query = request.GET.get("query", "is:unresolved").strip()
    sentry_sdk.set_tag("search.query", query)
    sentry_sdk.set_tag("search.sort", query)
    if projects:
        sentry_sdk.set_tag("search.projects", len(projects) if len(projects) <= 5 else ">5")
    if environments:
        sentry_sdk.set_tag(
            "search.environments", len(environments) if len(environments) <= 5 else ">5"
        )
    if query:
        try:
            search_filters = convert_query_values(
                parse_search_query(query), projects, request.user, environments
            )
        except InvalidSearchQuery as e:
            raise ValidationError(f"Error parsing search query: {e}")

        validate_search_filter_permissions(organization, search_filters, request.user)
        query_kwargs["search_filters"] = search_filters

    return query_kwargs


def validate_search_filter_permissions(
    organization: "Organization",
    search_filters: Sequence[SearchFilter],
    user: "User",
) -> None:
    """
    Verifies that an organization is allowed to perform the query that they
    submitted.
    If the org is using a feature they don't have access to, raises
    `ValidationError` with information which part of the query they don't have
    access to.
    :param search_filters:
    """
    # If the organization has advanced search, then no need to perform any
    # other checks since they're allowed to use all search features
    if features.has("organizations:advanced-search", organization):
        return None

    for search_filter in search_filters:
        for feature_condition, feature_name in advanced_search_features:
            if feature_condition(search_filter):
                advanced_search_feature_gated.send_robust(
                    user=user, organization=organization, sender=validate_search_filter_permissions
                )
                raise ValidationError(
                    f"You need access to the advanced search feature to use {feature_name}"
                )


def get_by_short_id(
    organization_id: int,
    is_short_id_lookup: str,
    query: str,
) -> Optional["Group"]:
    if is_short_id_lookup == "1" and looks_like_short_id(query):
        try:
            return Group.objects.by_qualified_short_id(organization_id, query)
        except Group.DoesNotExist:
            pass
    return None


def track_slo_response(name: str) -> Callable[[EndpointFunction], EndpointFunction]:
    def inner_func(function: EndpointFunction) -> EndpointFunction:
        def wrapper(request: Request, *args: Any, **kwargs: Any) -> Response:
            from sentry.utils import snuba

            try:
                response = function(request, *args, **kwargs)
            except snuba.RateLimitExceeded:
                metrics.incr(
                    f"{name}.slo.http_response",
                    sample_rate=1.0,
                    tags={
                        "status": 429,
                        "detail": "snuba.RateLimitExceeded",
                        "func": function.__qualname__,
                    },
                )
                raise
            except Exception:
                metrics.incr(
                    f"{name}.slo.http_response",
                    sample_rate=1.0,
                    tags={"status": 500, "detail": "Exception"},
                )
                # Continue raising the error now that we've incr the metric
                raise

            metrics.incr(
                f"{name}.slo.http_response",
                sample_rate=1.0,
                tags={"status": response.status_code, "detail": "response"},
            )
            return response

        return wrapper

    return inner_func


def calculate_stats_period(
    stats_period: Optional[str],
    start: Optional[datetime],
    end: Optional[datetime],
) -> Tuple[Optional[str], Optional[datetime], Optional[datetime]]:
    if stats_period is None:
        # default
        stats_period = "24h"
    elif stats_period == "":
        # disable stats
        stats_period = None

    if stats_period == "auto":
        stats_period_start = start
        stats_period_end = end
    else:
        stats_period_start = None
        stats_period_end = None
    return stats_period, stats_period_start, stats_period_end


def prep_search(
    cls: Any,
    request: Request,
    project: "Project",
    extra_query_kwargs: Optional[Mapping[str, Any]] = None,
) -> Tuple[CursorResult[Group], Mapping[str, Any]]:
    try:
        environment = cls._get_environment_from_request(request, project.organization_id)
    except Environment.DoesNotExist:
        result = CursorResult[Group](
            [], Cursor(0, 0, 0), Cursor(0, 0, 0), hits=0, max_hits=SEARCH_MAX_HITS
        )
        query_kwargs: MutableMapping[str, Any] = {}
    else:
        environments = [environment] if environment is not None else environment
        query_kwargs = build_query_params_from_request(
            request, project.organization, [project], environments
        )
        if extra_query_kwargs is not None:
            assert "environment" not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        query_kwargs["environments"] = environments
        query_kwargs["actor"] = request.user
        result = search.query(**query_kwargs)
    return result, query_kwargs


def get_first_last_release(
    request: Request,
    group: "Group",
) -> Tuple[Optional[Mapping[str, Any]], Optional[Mapping[str, Any]]]:
    first_release = group.get_first_release()
    if first_release is not None:
        last_release = group.get_last_release()
    else:
        last_release = None

    if first_release is not None and last_release is not None:
        first_release, last_release = get_first_last_release_info(
            request, group, [first_release, last_release]
        )
    elif first_release is not None:
        first_release = get_release_info(request, group, first_release)
    elif last_release is not None:
        last_release = get_release_info(request, group, last_release)

    return first_release, last_release


def get_release_info(request: Request, group: "Group", version: str) -> Mapping[str, Any]:
    try:
        release = Release.objects.get(
            projects=group.project,
            organization_id=group.project.organization_id,
            version=version,
        )
    except Release.DoesNotExist:
        release = {"version": version}

    # Explicitly typing to satisfy mypy.
    release_ifo: Mapping[str, Any] = serialize(release, request.user)
    return release_ifo


def get_first_last_release_info(
    request: Request,
    group: "Group",
    versions: Sequence[str],
) -> Sequence[Mapping[str, Any]]:
    releases = {
        release.version: release
        for release in Release.objects.filter(
            projects=group.project,
            organization_id=group.project.organization_id,
            version__in=versions,
        )
    }
    serialized_releases = serialize(
        [releases.get(version) for version in versions],
        request.user,
    )
    # Default to a dictionary if the release object wasn't found and not serialized
    return [
        item if item is not None else {"version": version}
        for item, version in zip(serialized_releases, versions)
    ]
