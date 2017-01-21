from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CommitSerializer, ListField
from sentry.models import Activity, Group, Release, ReleaseFile
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_RELEASE_REFERENCED = "This release is referenced by active issues and cannot be removed."


@scenario('RetrieveRelease')
def retrieve_release_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/releases/%s/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version)
    )


@scenario('UpdateRelease')
def update_release_scenario(runner):
    release = runner.utils.create_release(runner.default_project,
                                          runner.me, version='3000')
    runner.request(
        method='PUT',
        path='/projects/%s/%s/releases/%s/' % (
            runner.org.slug, runner.default_project.slug,
            release.version),
        data={
            'url': 'https://vcshub.invalid/user/project/refs/deadbeef1337',
            'ref': 'deadbeef1337'
        }
    )

# TODO(dcramer): this can't work with the current fixtures
# as an existing Group references the Release
# @scenario('DeleteRelease')
# def delete_release_scenario(runner):
#     release = runner.utils.create_release(runner.default_project,
#                                           runner.me, version='4000')
#     runner.request(
#         method='DELETE',
#         path='/projects/%s/%s/releases/%s/' % (
#             runner.org.slug, runner.default_project.slug,
#             release.version)
#     )


class ReleaseSerializer(serializers.Serializer):
    ref = serializers.CharField(max_length=64, required=False)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateReleased = serializers.DateTimeField(required=False)
    commits = ListField(child=CommitSerializer(), required=False)


class ReleaseDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectReleasePermission,)

    @attach_scenarios([retrieve_release_scenario])
    def get(self, request, project, version):
        """
        Retrieve a Release
        ``````````````````

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
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(release, request.user))

    @attach_scenarios([update_release_scenario])
    def put(self, request, project, version):
        """
        Update a Release
        ````````````````

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
        :param datetime dateStarted: an optional date that indicates when the
                                     release process started.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :auth: required
        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseSerializer(data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        was_released = bool(release.date_released)

        kwargs = {}
        if result.get('dateStarted'):
            kwargs['date_started'] = result['dateStarted']
        if result.get('dateReleased'):
            kwargs['date_released'] = result['dateReleased']
        if result.get('ref'):
            kwargs['ref'] = result['ref']
        if result.get('url'):
            kwargs['url'] = result['url']

        if kwargs:
            release.update(**kwargs)

        commit_list = result.get('commits')
        if commit_list:
            hook = ReleaseHook(project)
            # TODO(dcramer): handle errors with release payloads
            hook.set_commits(release.version, commit_list)

        if (not was_released and release.date_released):
            activity = Activity.objects.create(
                type=Activity.RELEASE,
                project=project,
                ident=release.version,
                data={'version': release.version},
                datetime=release.date_released,
            )
            activity.send_notification()

        return Response(serialize(release, request.user))

    # @attach_scenarios([delete_release_scenario])
    def delete(self, request, project, version):
        """
        Delete a Release
        ````````````````

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
                project=project,
                version=version,
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
        file_list = ReleaseFile.objects.filter(
            release=release,
        ).select_related('file')
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        release.delete()

        return Response(status=204)
