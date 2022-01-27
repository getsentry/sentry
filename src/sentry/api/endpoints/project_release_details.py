from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import ReleaseAnalyticsMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.organization_releases import get_stats_period_detail
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ReleaseSerializer
from sentry.models import Activity, Release
from sentry.models.release import UnsafeReleaseDeletion
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.snuba.sessions import STATS_PERIODS
from sentry.utils.sdk import bind_organization_context, configure_scope


class ProjectReleaseDetailsEndpoint(ProjectEndpoint, ReleaseAnalyticsMixin):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        """
        Retrieve a Project's Release
        ````````````````````````````

        Return details on an individual release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to retrieve the
                                     release of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        with_health = request.GET.get("health") == "1"
        summary_stats_period = request.GET.get("summaryStatsPeriod") or "14d"
        health_stats_period = request.GET.get("healthStatsPeriod") or ("24h" if with_health else "")
        if summary_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("summaryStatsPeriod", STATS_PERIODS))
        if health_stats_period and health_stats_period not in STATS_PERIODS:
            raise ParseError(detail=get_stats_period_detail("healthStatsPeriod", STATS_PERIODS))

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if with_health:
            release._for_project_id = project.id

        return Response(
            serialize(
                release,
                request.user,
                project=project,
                with_health_data=with_health,
                summary_stats_period=summary_stats_period,
                health_stats_period=health_stats_period,
            )
        )

    def put(self, request: Request, project, version) -> Response:
        """
        Update a Project's Release
        ``````````````````````````

        Update a release.  This can change some metadata associated with
        the release (the ref, url, and dates).

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :pparam string version: the version identifier of the release.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :auth: required
        """
        bind_organization_context(project.organization)
        with configure_scope() as scope:
            scope.set_tag("version", version)
            try:
                release = Release.objects.get(
                    organization_id=project.organization_id, projects=project, version=version
                )
            except Release.DoesNotExist:
                scope.set_tag("failure_reason", "Release.DoesNotExist")
                raise ResourceDoesNotExist

            serializer = ReleaseSerializer(data=request.data, partial=True)

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
                hook = ReleaseHook(project)
                # TODO(dcramer): handle errors with release payloads
                hook.set_commits(release.version, commit_list)
                self.track_set_commits_local(
                    request, organization_id=project.organization_id, project_ids=[project.id]
                )

            if not was_released and release.date_released:
                Activity.objects.create(
                    type=Activity.RELEASE,
                    project=project,
                    ident=Activity.get_version_ident(release.version),
                    data={"version": release.version},
                    datetime=release.date_released,
                )

            return Response(serialize(release, request.user))

    def delete(self, request: Request, project, version) -> Response:
        """
        Delete a Project's Release
        ``````````````````````````

        Permanently remove a release and all of its files.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                     release of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            release.safe_delete()
        except UnsafeReleaseDeletion as e:
            return Response({"detail": str(e)}, status=400)

        return Response(status=204)
