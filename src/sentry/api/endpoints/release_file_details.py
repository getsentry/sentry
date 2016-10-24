from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('RetrieveReleaseFile')
def retrieve_file_scenario(runner):
    rf = runner.utils.create_release_file(
        project=runner.default_project,
        release=runner.default_release,
        path='/demo/readme.txt',
        contents='Hello World!'
    )
    runner.request(
        method='GET',
        path='/projects/%s/%s/releases/%s/files/%s/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version, rf.id)
    )


@scenario('UpdateReleaseFile')
def update_file_scenario(runner):
    rf = runner.utils.create_release_file(
        project=runner.default_project,
        release=runner.default_release,
        path='/demo/hello.txt',
        contents='Good bye World!'
    )
    runner.request(
        method='PUT',
        path='/projects/%s/%s/releases/%s/files/%s/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version, rf.id),
        data={
            'name': '/demo/goodbye.txt'
        }
    )


@scenario('DeleteReleaseFile')
def delete_file_scenario(runner):
    rf = runner.utils.create_release_file(
        project=runner.default_project,
        release=runner.default_release,
        path='/demo/badfile.txt',
        contents='Whatever!'
    )
    runner.request(
        method='DELETE',
        path='/projects/%s/%s/releases/%s/files/%s/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version, rf.id)
    )


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


class ReleaseFileDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectReleasePermission,)

    @attach_scenarios([retrieve_file_scenario])
    def get(self, request, project, version, file_id):
        """
        Retrieve a File
        ```````````````

        Return details on an individual file within a release.  This does
        not actually return the contents of the file, just the associated
        metadata.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to retrieve the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to retrieve.
        :auth: required
        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(releasefile, request.user))

    @attach_scenarios([update_file_scenario])
    def put(self, request, project, version, file_id):
        """
        Update a File
        `````````````

        Update metadata of an existing file.  Currently only the name of
        the file can be changed.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to update the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to update.
        :param string name: the new name of the file.
        :auth: required
        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseFileSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        releasefile.update(
            name=result['name'],
        )

        return Response(serialize(releasefile, request.user))

    @attach_scenarios([delete_file_scenario])
    def delete(self, request, project, version, file_id):
        """
        Delete a File
        `````````````

        Permanently remove a file from a release.

        This will also remove the physical file from storage.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to delete.
        :auth: required
        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        file = releasefile.file

        # TODO(dcramer): this doesnt handle a failure from file.deletefile() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)
