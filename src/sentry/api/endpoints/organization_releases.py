from __future__ import absolute_import

from itertools import izip

import six
from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.bases import NoProjects, OrganizationEventsError
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import InvalidRepository
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release import ReleaseSerializer
from sentry.api.serializers.rest_framework import (
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
    ReleaseWithVersionSerializer,
    ListField,
)
from sentry.models import (
    Activity,
    Release,
    ReleaseProjectEnvironment,
    ReleaseProject,
    Project,
    ReleaseEnvironment,
)
from sentry.signals import release_created
from sentry.snuba.sessions import get_changed_release_model_materializations
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.cache import cache


@scenario("CreateNewOrganizationReleaseWithRef")
def create_new_org_release_ref_scenario(runner):
    runner.request(
        method="POST",
        path="/organizations/%s/releases/" % (runner.org.slug,),
        data={
            "version": "2.0rc2",
            "ref": "6ba09a7c53235ee8a8fa5ee4c1ca8ca886e7fdbb",
            "projects": [runner.default_project.slug],
        },
    )


@scenario("CreateNewOrganizationReleaseWithCommits")
def create_new_org_release_commit_scenario(runner):
    runner.request(
        method="POST",
        path="/organizations/%s/releases/" % (runner.org.slug,),
        data={
            "version": "2.0rc3",
            "projects": [runner.default_project.slug],
            "commits": [
                {
                    "patch_set": [
                        {"path": "path/to/added-file.html", "type": "A"},
                        {"path": "path/to/modified-file.html", "type": "M"},
                        {"path": "path/to/deleted-file.html", "type": "D"},
                    ],
                    "repository": "owner-name/repo-name",
                    "author_name": "Author Name",
                    "author_email": "author_email@example.com",
                    "timestamp": "2018-09-20T11:50:22+03:00",
                    "message": "This is the commit message.",
                    "id": "8371445ab8a9facd271df17038ff295a48accae7",
                }
            ],
        },
    )


@scenario("ListOrganizationReleases")
def list_org_releases_scenario(runner):
    runner.request(method="GET", path="/organizations/%s/releases/" % (runner.org.slug,))


class ReleaseSerializerWithProjects(ReleaseWithVersionSerializer):
    projects = ListField()
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


def debounce_update_releases_on_health_data(organization, project_ids):
    # Figure out which projects need to get updates from the snuba
    should_update = {}
    cache_keys = ["debounce-health:%d" % id for id in project_ids]
    for project_id, indicator, cache_key in izip(
        project_ids, cache.get_many(cache_keys), cache_keys
    ):
        if indicator is None:
            should_update[project_id] = cache_key
            should_update.add(project_id)

    if not should_update:
        return

    # TODO: if should_update grows too large we want to start doing multiple
    # snuba queries or spawn a background task.

    uniq_users_per_env = {}
    uniq_users_per_release = {}
    totals_users_per_env = {}
    totals_users_per_release = {}
    things_to_update = []

    # This gives us updates for all release-environments which have seen new
    # health data over the last 24 hours. It will miss releases where the last
    # date is <24h ago.  We need to aggregate the data for the totals per release
    # manually here now.
    for stats in get_changed_release_model_materializations(should_update.keys()):
        project = Project.objects.get_from_cache(id=stats["project_id"])

        # We might have never observed the release.  This for instance can
        # happen if the release only had health data so far.  For these cases
        # we want to create the release the first time we observed it on the
        # health side.
        release = Release.get_or_create(project=project, version=stats["release"])

        # Make sure that the release knows about this project.  Like we had before
        # the project might not have been associated with this release yet.
        release.add_project_and_update_health_data(project, adoption=int(stats["adoption"] * 1000))

        ReleaseEnvironment.get_or_create(
            project=project,
            release=release,
            environment=stats["environment"],
            datetime=stats["date"],
        )

        things_to_update.append(release, project)

    """
        key = (stats["release"], stats["project_id"])
        uniq_users[key] = (uniq_users.get(key) or 0) + stats["uniq_users"]
        total_users[key] = (total_users.get(key) or 0) + stats["total_users_24h"]

        adoption = int(float(stats["uniq_users"]) / stats["total_users_24h"] * 100
            if stats["uniq_users"] and stats["total_users_24h"] else 0.0) * 1000
        ReleaseProjectEnvironment.get_or_create(
            project=project,
            release=release,
            environment=stats["environment"],
            datetime=stats["date"],
            adoption=adoption,
        )
        """

    # Debounce updates for a minute
    cache.set_many(dict(izip(should_update.values(), [True] * len(should_update))), 60)


class OrganizationReleasesEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    doc_section = DocSection.RELEASES

    @attach_scenarios([list_org_releases_scenario])
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
        flatten = request.GET.get("flatten") == "1"

        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response([])
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)

        # if with_health:
        #    debounce_update_releases_on_health_data(organization, filter_params["project_id"])

        queryset = Release.objects.filter(
            organization=organization, projects__id__in=filter_params["project_id"]
        ).select_related("owner")

        if "environment" in filter_params:
            queryset = queryset.filter(
                releaseprojectenvironment__environment__name__in=filter_params["environment"],
                releaseprojectenvironment__project_id__in=filter_params["project_id"],
            )

        if query:
            queryset = queryset.filter(version__istartswith=query)

        sort_query = "COALESCE(sentry_release.date_released, sentry_release.date_added)"
        select_extra = {"sort": sort_query}

        if flatten:
            select_extra["_for_project_id"] = "sentry_release_project.project_id"
        else:
            queryset = queryset.distinct()

        queryset = queryset.extra(select=select_extra)
        if filter_params["start"] and filter_params["end"]:
            queryset = queryset.extra(
                where=["%s BETWEEN %%s and %%s" % sort_query],
                params=[filter_params["start"], filter_params["end"]],
            )

        serializer = ReleaseSerializer(with_health_data=with_health)
        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-sort",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )

    @attach_scenarios([create_new_org_release_ref_scenario, create_new_org_release_commit_scenario])
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
        serializer = ReleaseSerializerWithProjects(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            allowed_projects = {p.slug: p for p in self.get_projects(request, organization)}

            projects = []
            for slug in result["projects"]:
                if slug not in allowed_projects:
                    return Response({"projects": ["Invalid project slugs"]}, status=400)
                projects.append(allowed_projects[slug])

            # release creation is idempotent to simplify user
            # experiences
            try:
                with transaction.atomic():
                    release, created = (
                        Release.objects.create(
                            organization_id=organization.id,
                            version=result["version"],
                            ref=result.get("ref"),
                            url=result.get("url"),
                            owner=result.get("owner"),
                            date_released=result.get("dateReleased"),
                        ),
                        True,
                    )
            except IntegrityError:
                release, created = (
                    Release.objects.get(organization_id=organization.id, version=result["version"]),
                    False,
                )
            else:
                release_created.send_robust(release=release, sender=self.__class__)

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
                release.set_commits(commit_list)

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
            if refs:
                if not request.user.is_authenticated():
                    return Response(
                        {"refs": ["You must use an authenticated API token to fetch refs"]},
                        status=400,
                    )
                fetch_commits = not commit_list
                try:
                    release.set_refs(refs, request.user, fetch=fetch_commits)
                except InvalidRepository as e:
                    return Response({"refs": [six.text_type(e)]}, status=400)

            if not created and not new_projects:
                # This is the closest status code that makes sense, and we want
                # a unique 2xx response code so people can understand when
                # behavior differs.
                #   208 Already Reported (WebDAV; RFC 5842)
                status = 208
            else:
                status = 201

            return Response(serialize(release, request.user), status=status)
        return Response(serializer.errors, status=400)
