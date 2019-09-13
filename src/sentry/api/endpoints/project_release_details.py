from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ReleaseSerializer

from sentry.models import Activity, Group, Release, ReleaseFile
from sentry.plugins.interfaces.releasehook import ReleaseHook


ERR_RELEASE_REFERENCED = "This release is referenced by active issues and cannot be removed."


class ProjectReleaseDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
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
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(release, request.user, project=project))

    def put(self, request, project, version):
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
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
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

        if kwargs:
            release.update(**kwargs)

        commit_list = result.get("commits")
        if commit_list:
            hook = ReleaseHook(project)
            # TODO(dcramer): handle errors with release payloads
            hook.set_commits(release.version, commit_list)

        if not was_released and release.date_released:
            Activity.objects.create(
                type=Activity.RELEASE,
                project=project,
                ident=Activity.get_version_ident(release.version),
                data={"version": release.version},
                datetime=release.date_released,
            )

        return Response(serialize(release, request.user))

    def delete(self, request, project, version):
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

        # we don't want to remove the first_release metadata on the Group, and
        # while people might want to kill a release (maybe to remove files),
        # removing the release is prevented
        if Group.objects.filter(first_release=release).exists():
            return Response({"detail": ERR_RELEASE_REFERENCED}, status=400)

        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        file_list = ReleaseFile.objects.filter(release=release).select_related("file")
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        release.delete()

        return Response(status=204)
