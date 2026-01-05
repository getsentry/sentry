from __future__ import annotations

import re
from datetime import datetime, timedelta

import sentry_sdk
from django.db import IntegrityError
from django.db.models import F, Q
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ListField

from sentry import analytics, features, release_health
from sentry.analytics.events.release_created import ReleaseCreatedEvent
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import ReleaseAnalyticsMixin, region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ConflictError, InvalidRepository
from sentry.api.paginator import (
    MAX_LIMIT,
    BadPaginationError,
    MergingOffsetPaginator,
    OffsetPaginator,
)
from sentry.api.release_search import (
    FINALIZED_KEY,
    RELEASE_CREATED_KEY,
    RELEASE_FREE_TEXT_KEY,
    parse_search_query,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
    ReleaseWithVersionSerializer,
)
from sentry.api.utils import get_auth_api_token_type
from sentry.exceptions import InvalidSearchQuery
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.models.project import Project
from sentry.models.release import (
    Release,
    ReleaseStatus,
    filter_releases_by_environments,
    filter_releases_by_projects,
)
from sentry.models.releases.exceptions import ReleaseCommitError
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.releases.util import SemverFilter
from sentry.ratelimits.config import RateLimitConfig
from sentry.releases.use_cases.release import serialize as release_serializer
from sentry.search.events.constants import (
    OPERATOR_TO_DJANGO,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.filter import handle_operator_negation, parse_semver
from sentry.search.utils import get_latest_release
from sentry.signals import release_created
from sentry.snuba.sessions import STATS_PERIODS
from sentry.types.activity import ActivityType
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.cache import cache
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.sdk import bind_organization_context

ERR_INVALID_STATS_PERIOD = "Invalid %s. Valid choices are %s"


def get_stats_period_detail(key, choices):
    return ERR_INVALID_STATS_PERIOD % (key, ", ".join("'%s'" % x for x in choices))


_release_suffix = re.compile(r"^(.*)\s+\(([^)]+)\)\s*$")


def add_environment_to_queryset(queryset, filter_params):
    if "environment" in filter_params:
        return queryset.filter(
            releaseprojectenvironment__environment__name__in=filter_params["environment"],
            releaseprojectenvironment__project_id__in=filter_params["project_id"],
        )
    return queryset


def add_date_filter_to_queryset(queryset, filter_params):
    """Once date has been coalesced over released and added, use it to filter releases"""
    if filter_params["start"] and filter_params["end"]:
        return queryset.filter(date__gte=filter_params["start"], date__lte=filter_params["end"])
    return queryset


def _filter_releases_by_query(queryset, organization, query, filter_params):
    search_filters = parse_search_query(query)
    for search_filter in search_filters:
        if search_filter.key.name == FINALIZED_KEY:
            if search_filter.value.value == "true":
                queryset = queryset.filter(date_released__isnull=False)
            elif search_filter.value.value == "false":
                queryset = queryset.filter(date_released__isnull=True)

        if search_filter.key.name == RELEASE_FREE_TEXT_KEY:
            query_q = Q(version__icontains=query)
            suffix_match = _release_suffix.match(query)
            if suffix_match is not None:
                query_q |= Q(version__icontains="%s+%s" % suffix_match.groups())

            queryset = queryset.filter(query_q)

        if search_filter.key.name == RELEASE_ALIAS:
            query_q = Q()
            kind, value_o = search_filter.value.classify_and_format_wildcard()
            if kind == "infix":
                query_q = Q(version__contains=value_o)
            elif kind == "suffix":
                query_q = Q(version__endswith=value_o)
            elif kind == "prefix":
                query_q = Q(version__startswith=value_o)
            elif search_filter.operator == "!=":
                query_q = ~Q(version=value_o)
            elif search_filter.operator == "NOT IN":
                query_q = ~Q(version__in=value_o)
            elif search_filter.operator == "IN":
                query_q = Q(version__in=value_o)
            elif value_o == "latest":
                latest_releases = get_latest_release(
                    projects=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    organization_id=organization.id,
                )
                query_q = Q(version__in=latest_releases)
            else:
                query_q = Q(version=search_filter.value.value)

            queryset = queryset.filter(query_q)

        if search_filter.key.name == SEMVER_ALIAS:
            queryset = queryset.filter_by_semver(
                organization.id, parse_semver(search_filter.value.raw_value, search_filter.operator)
            )

        if search_filter.key.name == SEMVER_PACKAGE_ALIAS:
            negated = search_filter.operator == "!="
            queryset = queryset.filter_by_semver(
                organization.id,
                SemverFilter("exact", [], search_filter.value.raw_value, negated),
            )

        if search_filter.key.name == RELEASE_STAGE_ALIAS:
            queryset = queryset.filter_by_stage(
                organization.id,
                search_filter.operator,
                search_filter.value.value,
                project_ids=filter_params["project_id"],
                environments=filter_params.get("environment"),
            )

        if search_filter.key.name == SEMVER_BUILD_ALIAS:
            (operator, negated) = handle_operator_negation(search_filter.operator)
            queryset = queryset.filter_by_semver_build(
                organization.id,
                OPERATOR_TO_DJANGO[operator],
                search_filter.value.raw_value,
                negated=negated,
            )

        if search_filter.key.name == RELEASE_CREATED_KEY:
            queryset = queryset.filter(
                **{
                    f"date_added__{OPERATOR_TO_DJANGO[search_filter.operator]}": search_filter.value.raw_value
                }
            )

    return queryset


class ReleaseSerializerWithProjects(ReleaseWithVersionSerializer):
    projects = ListField()
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


@sentry_sdk.trace
def debounce_update_release_health_data(organization, project_ids: list[int]):
    """This causes a flush of snuba health data to the postgres tables once
    per minute for the given projects.
    """
    # Figure out which projects need to get updates from the snuba.
    should_update = {}
    cache_keys = ["debounce-health:%d" % id for id in project_ids]
    cache_data = cache.get_many(cache_keys)
    for project_id, cache_key in zip(project_ids, cache_keys):
        if cache_data.get(cache_key) is None:
            should_update[project_id] = cache_key

    if not should_update:
        return

    projects = {p.id: p for p in Project.objects.get_many_from_cache(should_update.keys())}

    # This gives us updates for all release-projects which have seen new
    # health data over the last days. It will miss releases where the last
    # date is longer than what `get_changed_project_release_model_adoptions`
    # considers recent.
    project_releases = release_health.backend.get_changed_project_release_model_adoptions(
        should_update.keys()
    )

    # Pre-flight query which was broken out of the release-project query below. By running this
    # in a separate query we can utilize the index on (organization, version) and remove a join.
    # The total cost of the two queries is significantly less than a single query.
    release_ids_and_versions = dict(
        Release.objects.filter(
            organization_id=organization.id,
            version__in=[x[1] for x in project_releases],
        ).values_list("id", "version")
    )

    release_ids_and_project_ids = list(
        ReleaseProject.objects.filter(
            project_id__in=[x[0] for x in project_releases],
            release_id__in=release_ids_and_versions.keys(),
        ).values_list("release_id", "project_id")
    )

    # I'm zipping the results of the two queries above to emulate the results of the old query
    # which was removed. I'm not changing the existing semantics of the code. I'm only performance
    # optimizing database access. Feel free to change.
    existing = {
        (project_id, release_ids_and_versions[release_id])
        for release_id, project_id in release_ids_and_project_ids
    }

    to_upsert = []
    for key in project_releases:
        if key not in existing:
            to_upsert.append(key)

    if to_upsert:
        dates = release_health.backend.get_oldest_health_data_for_releases(to_upsert)

        for project_id, version in to_upsert:
            project = projects.get(project_id)
            if project is None:
                # should not happen
                continue

            # Ignore versions that were saved with an empty string before validation was added
            if not Release.is_valid_version(version):
                continue

            # We might have never observed the release.  This for instance can
            # happen if the release only had health data so far.  For these cases
            # we want to create the release the first time we observed it on the
            # health side.
            release = Release.get_or_create(
                project=project, version=version, date_added=dates.get((project_id, version))
            )

            # Make sure that the release knows about this project.  Like we had before
            # the project might not have been associated with this release yet.
            release.add_project(project)

    # Debounce updates for a minute
    cache.set_many(dict(zip(should_update.values(), [True] * len(should_update))), 60)


@region_silo_endpoint
class OrganizationReleasesEndpoint(OrganizationReleasesBaseEndpoint, ReleaseAnalyticsMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=40, window=1),
                RateLimitCategory.USER: RateLimit(limit=40, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1),
            },
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=40, window=1),
                RateLimitCategory.USER: RateLimit(limit=40, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1),
            },
        }
    )

    SESSION_SORTS = frozenset(
        [
            "crash_free_sessions",
            "crash_free_users",
            "sessions",
            "users",
            "sessions_24h",
            "users_24h",
        ]
    )

    def get_projects(self, request: Request, organization, project_ids=None, project_slugs=None):
        return super().get_projects(
            request,
            organization,
            project_ids=project_ids,
            project_slugs=project_slugs,
            include_all_accessible=False,
        )

    def get(self, request: Request, organization: Organization) -> Response:
        if (
            features.has("organizations:releases-serializer-v2", organization, actor=request.user)
            or request.headers.get("X-Performance-Optimizations") == "enabled"
        ):
            return self.__get_new(request, organization)
        else:
            return self.__get_old(request, organization)

    def __get_new(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Releases
        ```````````````````````````````
        Return a list of releases for a given organization.

        :pparam string organization_id_or_slug: the id or slug of the organization
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the version.
        """
        query = request.GET.get("query")
        status_filter = request.GET.get("status", "open")
        flatten = request.GET.get("flatten") == "1"
        sort = request.GET.get("sort") or "date"
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"

        if summary_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("summaryStatsPeriod", STATS_PERIODS))

        paginator_cls = OffsetPaginator
        paginator_kwargs = {}

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        # This should get us all the projects into postgres that have received
        # health data in the last 24 hours.
        debounce_update_release_health_data(organization, filter_params["project_id"])

        queryset = Release.objects.filter(organization_id=organization.id)
        queryset = filter_releases_by_environments(
            queryset,
            filter_params["project_id"],
            [e.id for e in filter_params.get("environment_objects", [])],
        )
        queryset = queryset.annotate(date=F("date_added"))

        if status_filter:
            try:
                status_int = ReleaseStatus.from_string(status_filter)
            except ValueError:
                raise ParseError(detail="invalid value for status")

            if status_int == ReleaseStatus.OPEN:
                queryset = queryset.filter(Q(status=status_int) | Q(status=None))
            else:
                queryset = queryset.filter(status=status_int)

        if query:
            try:
                queryset = _filter_releases_by_query(queryset, organization, query, filter_params)
            except InvalidSearchQuery as e:
                return Response(
                    {"detail": str(e)},
                    status=400,
                )

        queryset = filter_releases_by_projects(queryset, filter_params["project_id"])

        if sort == "date":
            queryset = queryset.order_by("-date")
            paginator_kwargs["order_by"] = "-date"
        elif sort == "build":
            queryset = queryset.filter(build_number__isnull=False).order_by("-build_number")
            paginator_kwargs["order_by"] = "-build_number"
        elif sort == "semver":
            queryset = queryset.annotate_prerelease_column()

            order_by = [F(col).desc(nulls_last=True) for col in Release.SEMVER_COLS]
            # TODO: Adding this extra sort order breaks index usage. Index usage is already broken
            # when we filter by status, so when we fix that we should also consider the best way to
            # make this work as expected.
            order_by.append(F("date_added").desc())
            paginator_kwargs["order_by"] = order_by
        elif sort == "adoption":
            # sort by adoption date (most recently adopted first)
            order_by = F("releaseprojectenvironment__adopted").desc(nulls_last=True)
            queryset = queryset.order_by(order_by)
            paginator_kwargs["order_by"] = order_by
        elif sort in self.SESSION_SORTS:
            if not flatten:
                return Response(
                    {"detail": "sorting by crash statistics requires flattening (flatten=1)"},
                    status=400,
                )

            def qs_load_func(queryset, total_offset, qs_offset, limit):
                # We want to fetch at least total_offset + limit releases to check, to make sure
                # we're not fetching only releases that were on previous pages.
                release_versions = list(
                    queryset.order_by_recent().values_list("version", flat=True)[
                        : total_offset + limit
                    ]
                )
                releases_with_session_data = release_health.backend.check_releases_have_health_data(
                    organization.id,
                    filter_params["project_id"],
                    release_versions,
                    (
                        filter_params["start"]
                        if filter_params["start"]
                        else datetime.utcnow() - timedelta(days=90)
                    ),
                    filter_params["end"] if filter_params["end"] else datetime.utcnow(),
                )
                valid_versions = [
                    rv for rv in release_versions if rv not in releases_with_session_data
                ]

                results = list(
                    Release.objects.filter(
                        organization_id=organization.id,
                        version__in=valid_versions,
                    ).order_by_recent()[qs_offset : qs_offset + limit]
                )
                return results

            paginator_cls = ReleasesMergingOffsetPaginator
            paginator_kwargs.update(
                data_load_func=lambda offset, limit: release_health.backend.get_project_releases_by_stability(
                    project_ids=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    scope=sort,
                    offset=offset,
                    stats_period=summary_stats_period,
                    limit=limit,
                ),
                data_count_func=lambda: release_health.backend.get_project_releases_count(
                    organization_id=organization.id,
                    project_ids=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    scope=sort,
                    stats_period=summary_stats_period,
                ),
                apply_to_queryset=lambda queryset, rows: queryset.filter(
                    version__in=list(x[1] for x in rows)
                ),
                queryset_load_func=qs_load_func,
                project_ids=filter_params["project_id"],
            )
        else:
            return Response({"detail": "invalid sort"}, status=400)

        queryset = add_date_filter_to_queryset(queryset, filter_params)

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=paginator_cls,
            on_results=lambda releases: release_serializer(
                releases,
                request.user,
                organization_id=organization.id,
                environment_ids=[e.id for e in filter_params.get("environment_objects", [])],
                projects=filter_params["project_objects"],
            ),
            **paginator_kwargs,
        )

    def __get_old(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Releases
        ```````````````````````````````
        Return a list of releases for a given organization.

        :pparam string organization_id_or_slug: the id or slug of the organization
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the version.
        """
        query = request.GET.get("query")
        with_health = request.GET.get("health") == "1"
        with_adoption_stages = request.GET.get("adoptionStages") == "1"
        status_filter = request.GET.get("status", "open")
        flatten = request.GET.get("flatten") == "1"
        sort = request.GET.get("sort") or "date"
        health_stat = request.GET.get("healthStat") or "sessions"
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"
        health_stats_period = request.GET.get("healthStatsPeriod") or ("24h" if with_health else "")

        if summary_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("summaryStatsPeriod", STATS_PERIODS))
        if health_stats_period and health_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("healthStatsPeriod", STATS_PERIODS))
        if health_stat not in ("sessions", "users"):
            raise ParseError(detail="invalid healthStat")

        paginator_cls = OffsetPaginator
        paginator_kwargs = {}

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        # This should get us all the projects into postgres that have received
        # health data in the last 24 hours.
        debounce_update_release_health_data(organization, filter_params["project_id"])

        queryset = Release.objects.filter(organization=organization)

        if status_filter:
            try:
                status_int = ReleaseStatus.from_string(status_filter)
            except ValueError:
                raise ParseError(detail="invalid value for status")

            if status_int == ReleaseStatus.OPEN:
                queryset = queryset.filter(Q(status=status_int) | Q(status=None))
            else:
                queryset = queryset.filter(status=status_int)

        queryset = queryset.annotate(date=F("date_added"))

        queryset = add_environment_to_queryset(queryset, filter_params)
        if query:
            try:
                queryset = _filter_releases_by_query(queryset, organization, query, filter_params)
            except InvalidSearchQuery as e:
                return Response(
                    {"detail": str(e)},
                    status=400,
                )

        select_extra = {}

        queryset = queryset.distinct()
        if flatten:
            select_extra["_for_project_id"] = "sentry_release_project.project_id"

        queryset = queryset.filter(projects__id__in=filter_params["project_id"])

        if sort == "date":
            queryset = queryset.order_by("-date")
            paginator_kwargs["order_by"] = "-date"
        elif sort == "build":
            queryset = queryset.filter(build_number__isnull=False).order_by("-build_number")
            paginator_kwargs["order_by"] = "-build_number"
        elif sort == "semver":
            queryset = queryset.annotate_prerelease_column()

            order_by = [F(col).desc(nulls_last=True) for col in Release.SEMVER_COLS]
            # TODO: Adding this extra sort order breaks index usage. Index usage is already broken
            # when we filter by status, so when we fix that we should also consider the best way to
            # make this work as expected.
            order_by.append(F("date_added").desc())
            paginator_kwargs["order_by"] = order_by
        elif sort == "adoption":
            # sort by adoption date (most recently adopted first)
            order_by = F("releaseprojectenvironment__adopted").desc(nulls_last=True)
            queryset = queryset.order_by(order_by)
            paginator_kwargs["order_by"] = order_by
        elif sort in self.SESSION_SORTS:
            if not flatten:
                return Response(
                    {"detail": "sorting by crash statistics requires flattening (flatten=1)"},
                    status=400,
                )

            def qs_load_func(queryset, total_offset, qs_offset, limit):
                # We want to fetch at least total_offset + limit releases to check, to make sure
                # we're not fetching only releases that were on previous pages.
                release_versions = list(
                    queryset.order_by_recent().values_list("version", flat=True)[
                        : total_offset + limit
                    ]
                )
                releases_with_session_data = release_health.backend.check_releases_have_health_data(
                    organization.id,
                    filter_params["project_id"],
                    release_versions,
                    (
                        filter_params["start"]
                        if filter_params["start"]
                        else datetime.utcnow() - timedelta(days=90)
                    ),
                    filter_params["end"] if filter_params["end"] else datetime.utcnow(),
                )
                valid_versions = [
                    rv for rv in release_versions if rv not in releases_with_session_data
                ]

                results = list(
                    Release.objects.filter(
                        organization_id=organization.id,
                        version__in=valid_versions,
                    ).order_by_recent()[qs_offset : qs_offset + limit]
                )
                return results

            paginator_cls = MergingOffsetPaginator
            paginator_kwargs.update(
                data_load_func=lambda offset, limit: release_health.backend.get_project_releases_by_stability(
                    project_ids=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    scope=sort,
                    offset=offset,
                    stats_period=summary_stats_period,
                    limit=limit,
                ),
                data_count_func=lambda: release_health.backend.get_project_releases_count(
                    organization_id=organization.id,
                    project_ids=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    scope=sort,
                    stats_period=summary_stats_period,
                ),
                apply_to_queryset=lambda queryset, rows: queryset.filter(
                    version__in=list(x[1] for x in rows)
                ),
                queryset_load_func=qs_load_func,
                key_from_model=lambda x: (x._for_project_id, x.version),
            )
        else:
            return Response({"detail": "invalid sort"}, status=400)

        queryset = queryset.extra(select=select_extra)
        queryset = add_date_filter_to_queryset(queryset, filter_params)

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=paginator_cls,
            on_results=lambda x: serialize(
                x,
                request.user,
                with_health_data=with_health,
                with_adoption_stages=with_adoption_stages,
                health_stat=health_stat,
                health_stats_period=health_stats_period,
                summary_stats_period=summary_stats_period,
                environments=filter_params.get("environment") or None,
            ),
            **paginator_kwargs,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a New Release for an Organization
        ````````````````````````````````````````
        Create a new release for the given Organization.  Releases are used by
        Sentry to improve its error reporting abilities by correlating
        first seen events with the release that might have introduced the
        problem.
        Releases are also necessary for sourcemaps and other debug features
        that require manual upload for functioning well.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          release belongs to.
        :param string version: a version identifier for this release. Can
                               be a version number, a commit hash etc. It cannot contain certain
                               whitespace characters (`\\r`, `\\n`, `\\f`, `\\x0c`, `\\t`) or any
                               slashes (`\\`, `/`). The version names `.`, `..` and `latest` are also
                               reserved, and cannot be used.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param array projects: a list of project ids or slugs that are involved in
                               this release
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :param array commits: an optional list of commit data to be associated
                              with the release. Commits must include parameters
                              ``id`` (the sha of the commit), and can optionally
                              include ``repository``, ``message``, ``patch_set``,
                              ``author_name``, ``author_email``, and ``timestamp``.
                              See [release without integration example](/workflow/releases/).
        :param array refs: an optional way to indicate the start and end commits
                           for each repository included in a release. Head commits
                           must include parameters ``repository`` and ``commit``
                           (the HEAD sha). They can optionally include ``previousCommit``
                           (the sha of the HEAD of the previous release), which should
                           be specified if this is the first time you've sent commit data.
                           ``commit`` may contain a range in the form of ``previousCommit..commit``
        :auth: required
        """
        bind_organization_context(organization)
        serializer = ReleaseSerializerWithProjects(
            data=request.data, context={"organization": organization}
        )

        scope = sentry_sdk.get_isolation_scope()
        if serializer.is_valid():
            result = serializer.validated_data
            scope.set_tag("version", result["version"])

            # Get all projects that are available to the user/token
            # Note: Does not use the "projects" data param from the request
            projects_from_request = self.get_projects(request, organization)
            allowed_projects: dict[object, Project] = {}
            for project in projects_from_request:
                allowed_projects[project.slug] = project
                allowed_projects[project.id] = project
                # Also accept project IDs as strings (Sentry CLI serializes project IDs as strings)
                allowed_projects[str(project.id)] = project

            projects: list[Project] = []
            for id_or_slug in result["projects"]:
                if id_or_slug not in allowed_projects:
                    return Response({"projects": ["Invalid project ids or slugs"]}, status=400)
                projects.append(allowed_projects[id_or_slug])

            new_status = result.get("status")
            owner_id: int | None = None
            if owner := result.get("owner"):
                owner_id = owner.id

            # release creation is idempotent to simplify user
            # experiences
            created = False
            try:
                release, created = Release.objects.get_or_create(
                    organization_id=organization.id,
                    version=result["version"],
                    defaults={
                        "ref": result.get("ref"),
                        "url": result.get("url"),
                        "owner_id": owner_id,
                        "date_released": result.get("dateReleased"),
                        "status": new_status or ReleaseStatus.OPEN,
                        "user_agent": request.META.get("HTTP_USER_AGENT", "")[:256],
                    },
                )
            except IntegrityError:
                raise ConflictError(
                    "Could not create the release it conflicts with existing data",
                )

            # In case of disabled Open Membership, we have to check for project-level
            # permissions on the existing release.
            release_projects = ReleaseProject.objects.filter(release=release)
            existing_projects = [rp.project for rp in release_projects]

            if not request.access.has_projects_access(existing_projects):
                projects_str = ", ".join([p.slug for p in existing_projects])
                return Response(
                    {
                        "projects": [
                            f"You do not have permission to one of the projects: {projects_str}"
                        ]
                    },
                    status=400,
                )

            if created:
                release_created.send_robust(release=release, sender=self.__class__)

            if not created and new_status is not None and new_status != release.status:
                release.status = new_status
                release.save()

            new_releaseprojects = []
            for project in projects:
                _, releaseproject_created = release.add_project(project)
                if releaseproject_created:
                    new_releaseprojects.append(project)

            if release.date_released:
                for project in new_releaseprojects:
                    Activity.objects.create(
                        type=ActivityType.RELEASE.value,
                        project=project,
                        ident=Activity.get_version_ident(result["version"]),
                        data={"version": result["version"]},
                        datetime=release.date_released,
                    )

            commit_list = result.get("commits")
            if commit_list:
                try:
                    release.set_commits(commit_list)
                    self.track_set_commits_local(
                        request,
                        organization_id=organization.id,
                        project_ids=[project.id for project in projects],
                    )
                except ReleaseCommitError:
                    raise ConflictError("Release commits are currently being processed")

            refs = result.get("refs")
            if not refs:
                refs = [
                    {
                        "repository": r["repository"],
                        "previousCommit": r.get("previousId"),
                        "commit": r["currentId"],
                    }
                    for r in result.get("headCommits", [])
                ]
            scope.set_tag("has_refs", bool(refs))
            if refs:
                if not request.user.is_authenticated and not request.auth:
                    scope.set_tag("failure_reason", "user_not_authenticated")
                    return Response(
                        {"refs": ["You must use an authenticated API token to fetch refs"]},
                        status=400,
                    )
                fetch_commits = not commit_list
                try:
                    release.set_refs(refs, request.user.id, fetch=fetch_commits)
                except InvalidRepository as e:
                    scope.set_tag("failure_reason", "InvalidRepository")
                    return Response({"refs": [str(e)]}, status=400)

            if not created and not new_releaseprojects:
                # This is the closest status code that makes sense, and we want
                # a unique 2xx response code so people can understand when
                # behavior differs.
                #   208 Already Reported (WebDAV; RFC 5842)
                status = 208
            else:
                status = 201

            analytics.record(
                ReleaseCreatedEvent(
                    user_id=request.user.id if request.user and request.user.id else None,
                    organization_id=organization.id,
                    project_ids=[project.id for project in projects],
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                    created_status=status,
                    auth_type=get_auth_api_token_type(request.auth),
                )
            )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id for project in projects])

            scope.set_tag("success_status", status)
            return Response(
                serialize(release, request.user, no_snuba_for_release_creation=True), status=status
            )
        scope.set_tag("failure_reason", "serializer_error")
        return Response(serializer.errors, status=400)


@region_silo_endpoint
class OrganizationReleasesStatsEndpoint(OrganizationReleasesBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List an Organization's Releases specifically for building timeseries
        ```````````````````````````````
        Return a list of releases for a given organization, sorted for most recent releases.

        :pparam string organization_id_or_slug: the id or slug of the organization
        """
        query = request.GET.get("query")

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])

        queryset = (
            Release.objects.filter(
                organization=organization, projects__id__in=filter_params["project_id"]
            )
            .annotate(
                date=F("date_added"),
            )
            .values("version", "date")
            .order_by("-date")
            .distinct()
        )

        queryset = add_date_filter_to_queryset(queryset, filter_params)
        queryset = add_environment_to_queryset(queryset, filter_params)
        if query:
            try:
                queryset = _filter_releases_by_query(queryset, organization, query, filter_params)
            except InvalidSearchQuery as e:
                return Response(
                    {"detail": str(e)},
                    status=400,
                )

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: [
                {"version": release["version"], "date": serialize(release["date"])} for release in x
            ],
            default_per_page=1000,
            max_per_page=1000,
            max_limit=1000,
            order_by="-date",
        )


class ReleasesMergingOffsetPaginator(OffsetPaginator):
    """
    Copied from the default MergingOffsetPaginator. Modified with some release's specific flair.
    """

    def __init__(
        self,
        queryset,
        data_load_func,
        apply_to_queryset,
        project_ids: list[int],
        key_from_data=None,
        max_limit=MAX_LIMIT,
        on_results=None,
        data_count_func=None,
        queryset_load_func=None,
    ):
        super().__init__(queryset, max_limit=max_limit, on_results=on_results)
        self.data_load_func = data_load_func
        self.apply_to_queryset = apply_to_queryset
        self.key_from_data = key_from_data or (lambda x: x)
        self.data_count_func = data_count_func
        self.queryset_load_func = queryset_load_func
        self.project_ids = project_ids

    def get_result(self, limit=100, cursor=None):
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        page = cursor.offset
        offset = cursor.offset * cursor.value
        limit = cursor.value or limit

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        primary_results = self.data_load_func(offset=offset, limit=self.max_limit + 1)

        # This is the reason we defined our own merging paginator. We need to look up the
        # project_id since it doesn't exist on the model. This was previously accomplished with a
        # join (and a distinct clause for other reasons) but it was horribly slow.
        queryset = self.apply_to_queryset(self.queryset, primary_results)
        releases = list(queryset)
        releases_projects = list(
            ReleaseProject.objects.filter(
                project_id__in=self.project_ids, release_id__in=[r.id for r in releases]
            ).values_list("release_id", "project_id")
        )

        rmap = {r.id: r for r in releases}
        mapping = {(pid, rmap[rid].version): rmap[rid] for rid, pid in releases_projects}

        results = []
        for row in primary_results:
            model = mapping.get(self.key_from_data(row))
            if model is not None:
                results.append(model)

        if self.queryset_load_func and self.data_count_func and len(results) < limit:
            # If we hit the end of the results from the data load func, check whether there are
            # any additional results in the queryset_load_func, if one is provided.
            extra_limit = limit - len(results) + 1
            total_data_count = self.data_count_func()
            total_offset = offset + len(results)
            qs_offset = max(0, total_offset - total_data_count)
            qs_results = self.queryset_load_func(
                self.queryset, total_offset, qs_offset, extra_limit
            )
            results.extend(qs_results)
            has_more = len(qs_results) == extra_limit
        else:
            has_more = len(primary_results) > limit

        results = results[:limit]
        next_cursor = Cursor(limit, page + 1, False, has_more)
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        if self.on_results:
            results = self.on_results(results)

        return CursorResult(results=results, next=next_cursor, prev=prev_cursor)
