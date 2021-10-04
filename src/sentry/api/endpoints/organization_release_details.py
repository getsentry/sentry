from django.db.models import Q
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features, release_health
from sentry.api.base import ReleaseAnalyticsMixin
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.organization_releases import (
    _release_suffix,
    add_environment_to_queryset,
    get_stats_period_detail,
)
from sentry.api.exceptions import ConflictError, InvalidRepository, ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    ListField,
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
    ReleaseSerializer,
)
from sentry.models import Activity, Project, Release, ReleaseCommitError, ReleaseStatus
from sentry.models.release import UnsafeReleaseDeletion
from sentry.snuba.sessions import STATS_PERIODS
from sentry.utils.sdk import bind_organization_context, configure_scope


class InvalidSortException(Exception):
    pass


class OrganizationReleaseSerializer(ReleaseSerializer):
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


def add_status_filter_to_queryset(queryset, status_filter):
    """
    Function that adds status filter on a queryset
    """
    try:
        status_int = ReleaseStatus.from_string(status_filter)
    except ValueError:
        raise ParseError(detail="invalid value for status")

    if status_int == ReleaseStatus.OPEN:
        queryset = queryset.filter(Q(status=status_int) | Q(status=None))
    else:
        queryset = queryset.filter(status=status_int)
    return queryset


def add_query_filter_to_queryset(queryset, query):
    """
    Function that adds a query filtering to a queryset
    """
    if query:
        query_q = Q(version__icontains=query)

        suffix_match = _release_suffix.match(query)
        if suffix_match is not None:
            query_q |= Q(version__icontains="%s+%s" % suffix_match.groups())

        queryset = queryset.filter(query_q)
    return queryset


class OrganizationReleaseDetailsPaginationMixin:
    @staticmethod
    def __get_prev_release_date_query_q_and_order_by(release):
        """
        Method that takes a release and returns a dictionary containing a date query Q expression
        and order by columns required to fetch previous release to that passed in release on date
        sorting
        """
        return {
            "date_query_q": Q(date_added__gt=release.date_added)
            | Q(date_added=release.date_added, id__gt=release.id),
            "order_by": ["date_added", "id"],
        }

    @staticmethod
    def __get_next_release_date_query_q_and_order_by(release):
        """
        Method that takes a release and returns a dictionary containing a date query Q expression
        and order by columns required to fetch next release to that passed in release on date
        sorting
        """
        return {
            "date_query_q": Q(date_added__lt=release.date_added)
            | Q(date_added=release.date_added, id__lt=release.id),
            "order_by": ["-date_added", "-id"],
        }

    @staticmethod
    def __get_release_according_to_filters_and_order_by_for_date_sort(
        org,
        filter_params,
        date_query_q,
        order_by,
        status_filter,
        query,
    ):
        """
        Helper function that executes a query on Release table based on different filters
        provided as inputs and orders that query based on `order_by` input provided
        Inputs:-
            * org: Organization object
            * filter_params:
            * date_query_q: List that contains the Q expressions needed to sort based on date
            * order_by: Contains columns that are used for ordering to sort based on date
            * status_filter: represents ReleaseStatus i.e. open, archived
            * query
        Returns:-
            Queryset that contains one element that represents either next or previous release
            based on the inputs
        """
        queryset = Release.objects.filter(
            date_query_q,
            organization=org,
            projects__id__in=filter_params["project_id"],
        )

        # Add status filter
        queryset = add_status_filter_to_queryset(queryset, status_filter)

        # Add query filter
        queryset = add_query_filter_to_queryset(queryset, query)

        # Add env filter
        queryset = add_environment_to_queryset(queryset, filter_params)

        # Orderby passed cols and limit to 1
        queryset = queryset.order_by(*order_by)[:1]

        return queryset

    def get_adjacent_releases_to_current_release(
        self,
        release,
        org,
        filter_params,
        stats_period,
        sort,
        status_filter,
        query,
    ):
        """
        Method that returns the prev and next release to a current release based on different
        sort options
        Inputs:-
            * release: current release object
            * org: organisation object
            * filter_params
            * stats_period
            * sort: sort option i.e. date, sessions, users, crash_free_users and crash_free_sessions
            * status_filter
            * query
        Returns:-
            A dictionary of two keys `prev_release_version` and `next_release_version` representing
            previous release and next release respectively
        """
        if sort == "date":
            release_common_filters = {
                "org": org,
                "filter_params": filter_params,
                "status_filter": status_filter,
                "query": query,
            }

            # Get previous queryset of current release
            prev_release_list = self.__get_release_according_to_filters_and_order_by_for_date_sort(
                **release_common_filters,
                **self.__get_prev_release_date_query_q_and_order_by(release),
            )
            # Get next queryset of current release
            next_release_list = self.__get_release_according_to_filters_and_order_by_for_date_sort(
                **release_common_filters,
                **self.__get_next_release_date_query_q_and_order_by(release),
            )
        else:
            raise InvalidSortException

        prev_release_version = None
        if len(prev_release_list) > 0:
            prev_release_version = prev_release_list[0].version

        next_release_version = None
        if len(next_release_list) > 0:
            next_release_version = next_release_list[0].version

        # This is reversed on purpose and the reason for that is that the prev and next releases
        # are computed in the same order as the releases list page and so for example if you have a
        # releases list ordered by date_created, that looks like this
        # * Release 3.0.0 -> Created last
        # * Release 2.0.0 -> Created before last
        # * Release 1.0.0 -> Created first
        # Then the prev and next for Release 2.0.0 would be Release 3.0.0 (more recent) and Release
        # 1.0.0 (less recent) respectively. This would however result in non-intuitive behaviour
        # in the UI because when you click on "<" (prev) you expect to go back to an "older"
        # release, but prev here will give you a more recent release as this list is ordered
        # in DESC order, and the same case can be made for when you click on ">" or next.
        return {
            "next_release_version": prev_release_version,
            "prev_release_version": next_release_version,
        }

    @staticmethod
    def __get_top_of_queryset_release_version_based_on_order_by(org, proj_and_env_dict, order_by):
        """
        Helper function that executes a query on Release table orders that query based on `order_by`
        input provided
        Inputs:-
            * org: Organization object
            * proj_and_env_dict: contains only two keys project_id and environment
            * order_by: Contains columns that are used for ordering to sort based on date
        Returns:-
            Release version of the top element of the queryset returned through ordering the Release
            table by the order_by input
        """
        queryset = Release.objects.filter(
            organization=org, projects__id__in=proj_and_env_dict["project_id"]
        )

        queryset = add_environment_to_queryset(queryset, proj_and_env_dict)

        release = queryset.order_by(*order_by).first()

        if not release:
            return None
        return release.version

    def get_first_and_last_releases(self, org, environment, project_id, sort):
        """
        Method that returns the first and last release based on `date_added`
        Inputs:-
            * org: organisation object
            * environment
            * project_id
            * sort: sort option i.e. date, sessions, users, crash_free_users and crash_free_sessions
        Returns:-
            A dictionary of two keys `first_release_version` and `last_release_version` representing
            the first ever created release and the last ever created releases respectively
        """
        first_release_version = None
        last_release_version = None

        if sort == "date":
            proj_and_env_dict = {"project_id": project_id}
            if environment is not None:
                proj_and_env_dict["environment"] = environment

            first_release_version = self.__get_top_of_queryset_release_version_based_on_order_by(
                org=org, proj_and_env_dict=proj_and_env_dict, order_by=["date_added", "id"]
            )
            last_release_version = self.__get_top_of_queryset_release_version_based_on_order_by(
                org=org, proj_and_env_dict=proj_and_env_dict, order_by=["-date_added", "-id"]
            )

        return {
            "first_release_version": first_release_version,
            "last_release_version": last_release_version,
        }


class OrganizationReleaseDetailsEndpoint(
    OrganizationReleasesBaseEndpoint,
    ReleaseAnalyticsMixin,
    OrganizationReleaseDetailsPaginationMixin,
):
    def get(self, request, organization, version):
        """
        Retrieve an Organization's Release
        ``````````````````````````````````

        Return details on an individual release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        # Dictionary responsible for storing selected project meta data
        current_project_meta = {}
        project_id = request.GET.get("project")
        with_health = request.GET.get("health") == "1"
        with_adoption_stages = request.GET.get("adoptionStages") == "1"
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"
        health_stats_period = request.GET.get("healthStatsPeriod") or ("24h" if with_health else "")
        sort = request.GET.get("sort") or "date"
        status_filter = request.GET.get("status", "open")
        query = request.GET.get("query")

        if summary_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("summaryStatsPeriod", STATS_PERIODS))
        if health_stats_period and health_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("healthStatsPeriod", STATS_PERIODS))

        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        if with_health and project_id:
            try:
                project = Project.objects.get_from_cache(id=int(project_id))
            except (ValueError, Project.DoesNotExist):
                raise ParseError(detail="Invalid project")
            release._for_project_id = project.id

        if project_id:
            # Add sessions time bound to current project meta data
            environments = set(request.GET.getlist("environment")) or None
            current_project_meta.update(
                {
                    **release_health.get_release_sessions_time_bounds(
                        project_id=int(project_id),
                        release=release.version,
                        org_id=organization.id,
                        environments=environments,
                    )
                }
            )

            # Get prev and next release to current release
            try:
                filter_params = self.get_filter_params(request, organization)
                current_project_meta.update(
                    {
                        **self.get_adjacent_releases_to_current_release(
                            org=organization,
                            release=release,
                            filter_params=filter_params,
                            stats_period=summary_stats_period,
                            sort=sort,
                            status_filter=status_filter,
                            query=query,
                        ),
                        **self.get_first_and_last_releases(
                            org=organization,
                            environment=filter_params.get("environment"),
                            project_id=[project_id],
                            sort=sort,
                        ),
                    }
                )
            except InvalidSortException:
                return Response({"detail": "invalid sort"}, status=400)

        with_adoption_stages = with_adoption_stages and features.has(
            "organizations:release-adoption-stage", organization, actor=request.user
        )

        return Response(
            serialize(
                release,
                request.user,
                with_health_data=with_health,
                with_adoption_stages=with_adoption_stages,
                summary_stats_period=summary_stats_period,
                health_stats_period=health_stats_period,
                current_project_meta=current_project_meta,
            )
        )

    def put(self, request, organization, version):
        """
        Update an Organization's Release
        ````````````````````````````````

        Update a release. This can change some metadata associated with
        the release (the ref, url, and dates).

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :param array commits: an optional list of commit data to be associated

                              with the release. Commits must include parameters
                              ``id`` (the sha of the commit), and can optionally
                              include ``repository``, ``message``, ``author_name``,
                              ``author_email``, and ``timestamp``.
        :param array refs: an optional way to indicate the start and end commits
                           for each repository included in a release. Head commits
                           must include parameters ``repository`` and ``commit``
                           (the HEAD sha). They can optionally include ``previousCommit``
                           (the sha of the HEAD of the previous release), which should
                           be specified if this is the first time you've sent commit data.
        :auth: required
        """
        bind_organization_context(organization)

        with configure_scope() as scope:
            scope.set_tag("version", version)
            try:
                release = Release.objects.get(organization_id=organization, version=version)
                projects = release.projects.all()
            except Release.DoesNotExist:
                scope.set_tag("failure_reason", "Release.DoesNotExist")
                raise ResourceDoesNotExist

            if not self.has_release_permission(request, organization, release):
                scope.set_tag("failure_reason", "no_release_permission")
                raise ResourceDoesNotExist

            serializer = OrganizationReleaseSerializer(data=request.data)

            if not serializer.is_valid():
                scope.set_tag("failure_reason", "serializer_error")
                return Response(serializer.errors, status=400)

            result = serializer.validated_data

            was_released = bool(release.date_released)

            kwargs = {}
            if result.get("dateReleased"):
                kwargs["date_released"] = result["dateReleased"]
            if result.get("ref"):
                kwargs["ref"] = result["ref"]
            if result.get("url"):
                kwargs["url"] = result["url"]
            if result.get("status"):
                kwargs["status"] = result["status"]

            if kwargs:
                release.update(**kwargs)

            commit_list = result.get("commits")
            if commit_list:
                # TODO(dcramer): handle errors with release payloads
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
                # Handle legacy
                if result.get("headCommits", []):
                    refs = [
                        {
                            "repository": r["repository"],
                            "previousCommit": r.get("previousId"),
                            "commit": r["currentId"],
                        }
                        for r in result.get("headCommits", [])
                    ]
                # Clear commits in release
                else:
                    if result.get("refs") == []:
                        release.clear_commits()

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

            if not was_released and release.date_released:
                for project in projects:
                    Activity.objects.create(
                        type=Activity.RELEASE,
                        project=project,
                        ident=Activity.get_version_ident(release.version),
                        data={"version": release.version},
                        datetime=release.date_released,
                    )

            return Response(serialize(release, request.user))

    def delete(self, request, organization, version):
        """
        Delete an Organization's Release
        ````````````````````````````````

        Permanently remove a release and all of its files.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        try:
            release.safe_delete()
        except UnsafeReleaseDeletion as e:
            return Response({"detail": str(e)}, status=400)

        return Response(status=204)
