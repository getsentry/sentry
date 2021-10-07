import re
from datetime import datetime, timedelta

from django.db import IntegrityError
from django.db.models import F, Q
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import analytics, features, release_health
from sentry.api.base import EnvironmentMixin, ReleaseAnalyticsMixin
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ConflictError, InvalidRepository
from sentry.api.paginator import MergingOffsetPaginator, OffsetPaginator
from sentry.api.release_search import RELEASE_FREE_TEXT_KEY, parse_search_query
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    ListField,
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
    ReleaseWithVersionSerializer,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models import (
    Activity,
    Project,
    Release,
    ReleaseCommitError,
    ReleaseProject,
    ReleaseStatus,
    SemverFilter,
)
from sentry.search.events.constants import (
    OPERATOR_TO_DJANGO,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.filter import handle_operator_negation, parse_semver
from sentry.signals import release_created
from sentry.snuba.sessions import STATS_PERIODS, get_project_releases_by_stability
from sentry.utils.cache import cache
from sentry.utils.compat import zip as izip
from sentry.utils.sdk import bind_organization_context, configure_scope

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
        if search_filter.key.name == RELEASE_FREE_TEXT_KEY:
            query_q = Q(version__icontains=query)
            suffix_match = _release_suffix.match(query)
            if suffix_match is not None:
                query_q |= Q(version__icontains="%s+%s" % suffix_match.groups())

            queryset = queryset.filter(query_q)

        if search_filter.key.name == RELEASE_ALIAS:
            if search_filter.value.is_wildcard():
                raw_value = search_filter.value.raw_value
                if raw_value.endswith("*") and raw_value.startswith("*"):
                    query_q = Q(version__contains=raw_value[1:-1])
                elif raw_value.endswith("*"):
                    query_q = Q(version__startswith=raw_value[:-1])
                elif raw_value.startswith("*"):
                    query_q = Q(version__endswith=raw_value[1:])
            elif search_filter.operator == "!=":
                query_q = ~Q(version=search_filter.value.value)
            else:
                query_q = Q(version=search_filter.value.value)

            queryset = queryset.filter(query_q)

        if search_filter.key.name == SEMVER_ALIAS:
            queryset = queryset.filter_by_semver(
                organization.id, parse_semver(search_filter.value.raw_value, search_filter.operator)
            )

        if search_filter.key.name == SEMVER_PACKAGE_ALIAS:
            negated = True if search_filter.operator == "!=" else False
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

    return queryset


class ReleaseSerializerWithProjects(ReleaseWithVersionSerializer):
    projects = ListField()
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


def debounce_update_release_health_data(organization, project_ids):
    """This causes a flush of snuba health data to the postgres tables once
    per minute for the given projects.
    """
    # Figure out which projects need to get updates from the snuba.
    should_update = {}
    cache_keys = ["debounce-health:%d" % id for id in project_ids]
    cache_data = cache.get_many(cache_keys)
    for project_id, cache_key in izip(project_ids, cache_keys):
        if cache_data.get(cache_key) is None:
            should_update[project_id] = cache_key

    if not should_update:
        return

    projects = {p.id: p for p in Project.objects.get_many_from_cache(should_update.keys())}

    # This gives us updates for all release-projects which have seen new
    # health data over the last days. It will miss releases where the last
    # date is longer than what `get_changed_project_release_model_adoptions`
    # considers recent.
    project_releases = release_health.get_changed_project_release_model_adoptions(
        should_update.keys()
    )

    # Check which we already have rows for.
    existing = set(
        ReleaseProject.objects.filter(
            project_id__in=[x[0] for x in project_releases],
            release__version__in=[x[1] for x in project_releases],
        ).values_list("project_id", "release__version")
    )
    to_upsert = []
    for key in project_releases:
        if key not in existing:
            to_upsert.append(key)

    if to_upsert:
        dates = release_health.get_oldest_health_data_for_releases(to_upsert)

        for project_id, version in to_upsert:
            project = projects.get(project_id)
            if project is None:
                # should not happen
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
    cache.set_many(dict(izip(should_update.values(), [True] * len(should_update))), 60)


class OrganizationReleasesEndpoint(
    OrganizationReleasesBaseEndpoint, EnvironmentMixin, ReleaseAnalyticsMixin
):
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

    def get(self, request, organization):
        """
        List an Organization's Releases
        ```````````````````````````````
        Return a list of releases for a given organization.

        :pparam string organization_slug: the organization short name
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

        queryset = queryset.select_related("owner").annotate(date=F("date_added"))

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
                releases_with_session_data = release_health.check_releases_have_health_data(
                    organization.id,
                    filter_params["project_id"],
                    release_versions,
                    filter_params["start"]
                    if filter_params["start"]
                    else datetime.utcnow() - timedelta(days=90),
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
                data_load_func=lambda offset, limit: get_project_releases_by_stability(
                    project_ids=filter_params["project_id"],
                    environments=filter_params.get("environment"),
                    scope=sort,
                    offset=offset,
                    stats_period=summary_stats_period,
                    limit=limit,
                ),
                data_count_func=lambda: release_health.get_project_releases_count(
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

        with_adoption_stages = with_adoption_stages and features.has(
            "organizations:release-adoption-stage", organization, actor=request.user
        )

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

    def post(self, request, organization):
        """
        Create a New Release for an Organization
        ````````````````````````````````````````
        Create a new release for the given Organization.  Releases are used by
        Sentry to improve its error reporting abilities by correlating
        first seen events with the release that might have introduced the
        problem.
        Releases are also necessary for sourcemaps and other debug features
        that require manual upload for functioning well.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :param string version: a version identifier for this release.  Can
                               be a version number, a commit hash etc.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param array projects: a list of project slugs that are involved in
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
        serializer = ReleaseSerializerWithProjects(data=request.data)

        with configure_scope() as scope:
            if serializer.is_valid():
                result = serializer.validated_data
                scope.set_tag("version", result["version"])

                allowed_projects = {p.slug: p for p in self.get_projects(request, organization)}

                projects = []
                for slug in result["projects"]:
                    if slug not in allowed_projects:
                        return Response({"projects": ["Invalid project slugs"]}, status=400)
                    projects.append(allowed_projects[slug])

                new_status = result.get("status")

                # release creation is idempotent to simplify user
                # experiences
                try:
                    release, created = Release.objects.get_or_create(
                        organization_id=organization.id,
                        version=result["version"],
                        defaults={
                            "ref": result.get("ref"),
                            "url": result.get("url"),
                            "owner": result.get("owner"),
                            "date_released": result.get("dateReleased"),
                            "status": new_status or ReleaseStatus.OPEN,
                        },
                    )
                except IntegrityError:
                    raise ConflictError(
                        "Could not create the release it conflicts with existing data",
                    )
                if created:
                    release_created.send_robust(release=release, sender=self.__class__)

                if not created and new_status is not None and new_status != release.status:
                    release.status = new_status
                    release.save()

                new_projects = []
                for project in projects:
                    created = release.add_project(project)
                    if created:
                        new_projects.append(project)

                if release.date_released:
                    for project in new_projects:
                        Activity.objects.create(
                            type=Activity.RELEASE,
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
                    if not request.user.is_authenticated:
                        scope.set_tag("failure_reason", "user_not_authenticated")
                        return Response(
                            {"refs": ["You must use an authenticated API token to fetch refs"]},
                            status=400,
                        )
                    fetch_commits = not commit_list
                    try:
                        release.set_refs(refs, request.user, fetch=fetch_commits)
                    except InvalidRepository as e:
                        scope.set_tag("failure_reason", "InvalidRepository")
                        return Response({"refs": [str(e)]}, status=400)

                if not created and not new_projects:
                    # This is the closest status code that makes sense, and we want
                    # a unique 2xx response code so people can understand when
                    # behavior differs.
                    #   208 Already Reported (WebDAV; RFC 5842)
                    status = 208
                else:
                    status = 201

                analytics.record(
                    "release.created",
                    user_id=request.user.id if request.user and request.user.id else None,
                    organization_id=organization.id,
                    project_ids=[project.id for project in projects],
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                    created_status=status,
                )

                scope.set_tag("success_status", status)
                return Response(serialize(release, request.user), status=status)
            scope.set_tag("failure_reason", "serializer_error")
            return Response(serializer.errors, status=400)


class OrganizationReleasesStatsEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    def get(self, request, organization):
        """
        List an Organization's Releases specifically for building timeseries
        ```````````````````````````````
        Return a list of releases for a given organization, sorted for most recent releases.

        :pparam string organization_slug: the organization short name
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
