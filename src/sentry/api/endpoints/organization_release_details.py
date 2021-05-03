from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.base import ReleaseAnalyticsMixin
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.organization_releases import get_stats_period_detail
from sentry.api.exceptions import ConflictError, InvalidRepository, ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    ListField,
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
    ReleaseSerializer,
)
from sentry.models import Activity, Project, Release, ReleaseCommitError
from sentry.models.release import UnsafeReleaseDeletion
from sentry.snuba.sessions import STATS_PERIODS, get_release_sessions_time_bounds
from sentry.utils.sdk import bind_organization_context, configure_scope


class OrganizationReleaseSerializer(ReleaseSerializer):
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


class OrganizationReleaseDetailsEndpoint(OrganizationReleasesBaseEndpoint, ReleaseAnalyticsMixin):
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
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"
        health_stats_period = request.GET.get("healthStatsPeriod") or ("24h" if with_health else "")

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
                    **get_release_sessions_time_bounds(
                        project_id=int(project_id),
                        release=release.version,
                        org_id=organization.id,
                        environments=environments,
                    )
                }
            )

        return Response(
            serialize(
                release,
                request.user,
                with_health_data=with_health,
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
