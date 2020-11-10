from __future__ import absolute_import

from django.db import IntegrityError, transaction

from rest_framework.response import Response

from sentry import analytics

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ReleaseWithVersionSerializer
from sentry.models import Activity, Environment, Release, ReleaseStatus
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.signals import release_created
from sentry.utils.sdk import configure_scope, bind_organization_context
from sentry.web.decorators import transaction_start


class ProjectReleasesEndpoint(ProjectEndpoint, EnvironmentMixin):
    permission_classes = (ProjectReleasePermission,)

    @transaction_start("ProjectReleasesEndpoint.get")
    def get(self, request, project):
        """
        List a Project's Releases
        `````````````````````````

        Retrieve a list of releases for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     releases of.
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the version.
        """
        query = request.GET.get("query")
        try:
            environment = self._get_environment_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            queryset = Release.objects.none()
            environment = None
        else:
            queryset = Release.objects.filter(
                projects=project, organization_id=project.organization_id, status=ReleaseStatus.OPEN
            ).select_related("owner")
            if environment is not None:
                queryset = queryset.filter(
                    releaseprojectenvironment__project=project,
                    releaseprojectenvironment__environment=environment,
                )

        if query:
            queryset = queryset.filter(version__icontains=query)

        queryset = queryset.extra(select={"sort": "COALESCE(date_released, date_added)"})

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-sort",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, project=project, environment=environment
            ),
        )

    @transaction_start("ProjectReleasesEndpoint.post")
    def post(self, request, project):
        """
        Create a New Release for a Project
        ``````````````````````````````````

        Create a new release and/or associate a project with a release.
        Release versions that are the same across multiple projects
        within an Organization will be treated as the same release in Sentry.

        Releases are used by Sentry to improve its error reporting abilities
        by correlating first seen events with the release that might have
        introduced the problem.

        Releases are also necessary for sourcemaps and other debug features
        that require manual upload for functioning well.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to create a
                                     release for.
        :param string version: a version identifier for this release.  Can
                               be a version number, a commit hash etc.
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
        serializer = ReleaseWithVersionSerializer(data=request.data)

        with configure_scope() as scope:
            if serializer.is_valid():
                result = serializer.validated_data
                scope.set_tag("version", result["version"])

                # release creation is idempotent to simplify user
                # experiences
                try:
                    with transaction.atomic():
                        release, created = (
                            Release.objects.create(
                                organization_id=project.organization_id,
                                version=result["version"],
                                ref=result.get("ref"),
                                url=result.get("url"),
                                owner=result.get("owner"),
                                date_released=result.get("dateReleased"),
                            ),
                            True,
                        )
                    was_released = False
                except IntegrityError:
                    release, created = (
                        Release.objects.get(
                            organization_id=project.organization_id, version=result["version"]
                        ),
                        False,
                    )
                    was_released = bool(release.date_released)
                else:
                    release_created.send_robust(release=release, sender=self.__class__)

                created = release.add_project(project)

                commit_list = result.get("commits")
                if commit_list:
                    hook = ReleaseHook(project)
                    # TODO(dcramer): handle errors with release payloads
                    hook.set_commits(release.version, commit_list)

                if not was_released and release.date_released:
                    Activity.objects.create(
                        type=Activity.RELEASE,
                        project=project,
                        ident=Activity.get_version_ident(result["version"]),
                        data={"version": result["version"]},
                        datetime=release.date_released,
                    )

                if not created:
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
                    organization_id=project.organization_id,
                    project_ids=[project.id],
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                    created_status=status,
                )
                scope.set_tag("success_status", status)
                return Response(serialize(release, request.user), status=status)
            scope.set_tag("failure_reason", "serializer_error")
            return Response(serializer.errors, status=400)
