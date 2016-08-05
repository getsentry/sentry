from __future__ import absolute_import

from django.db import IntegrityError, transaction
from six import BytesIO
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import File, Release, ReleaseFile
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_FILE_EXISTS = 'A file matching this name already exists for the given release'


@scenario('UploadReleaseFile')
def upload_file_scenario(runner):
    runner.request(
        method='POST',
        path='/projects/%s/%s/releases/%s/files/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version),
        data={
            'header': 'Content-Type:text/plain; encoding=utf-8',
            'name': '/demo/hello.py',
            'file': ('hello.py', BytesIO(b'print "Hello World!"')),
        },
        format='multipart'
    )


@scenario('ListReleaseFiles')
def list_files_scenario(runner):
    runner.utils.create_release_file(
        project=runner.default_project,
        release=runner.default_release,
        path='/demo/message-for-you.txt',
        contents='Hello World!'
    )
    runner.request(
        method='GET',
        path='/projects/%s/%s/releases/%s/files/' % (
            runner.org.slug, runner.default_project.slug,
            runner.default_release.version)
    )


class ConditionalContentNegotiation(DefaultContentNegotiation):
    """
    Overrides the parsers on POST to support file uploads.
    """
    def select_parser(self, request, parsers):
        if request.method == 'POST':
            parsers = [FormParser(), MultiPartParser()]

        return super(ConditionalContentNegotiation, self).select_parser(
            request, parsers
        )


class ReleaseFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    content_negotiation_class = ConditionalContentNegotiation
    permission_classes = (ProjectReleasePermission,)

    @attach_scenarios([list_files_scenario])
    def get(self, request, project, version):
        """
        List a Release's Files
        ``````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
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

        file_list = ReleaseFile.objects.filter(
            release=release,
        ).select_related('file').order_by('name')

        return self.paginate(
            request=request,
            queryset=file_list,
            order_by='name',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    @attach_scenarios([upload_file_scenario])
    def post(self, request, project, version):
        """
        Upload a New File
        `````````````````

        Upload a new file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The optional 'name' attribute should reflect the absolute path
        that this file will be referenced as. For example, in the case of
        JavaScript you might specify the full web URI.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :pparam string version: the version identifier of the release.
        :param string name: the name (full path) of the file.
        :param file file: the multipart encoded file.
        :param string header: this parameter can be supplied multiple times
                              to attach headers to the file.  Each header
                              is a string in the format ``key:value``.  For
                              instance it can be used to define a content
                              type.
        :auth: required
        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if 'file' not in request.FILES:
            return Response({'detail': 'Missing uploaded file'}, status=400)

        fileobj = request.FILES['file']

        full_name = request.DATA.get('name', fileobj.name)
        if not full_name:
            return Response({'detail': 'File name must be specified'}, status=400)
        name = full_name.rsplit('/', 1)[-1]

        headers = {
            'Content-Type': fileobj.content_type,
        }
        for headerval in request.DATA.getlist('header') or ():
            try:
                k, v = headerval.split(':', 1)
            except ValueError:
                return Response({'detail': 'header value was not formatted correctly'}, status=400)
            else:
                headers[k] = v.strip()

        file = File.objects.create(
            name=name,
            type='release.file',
            headers=headers,
        )
        file.putfile(fileobj)

        try:
            with transaction.atomic():
                releasefile = ReleaseFile.objects.create(
                    project=release.project,
                    release=release,
                    file=file,
                    name=full_name,
                )
        except IntegrityError:
            file.delete()
            return Response({'detail': ERR_FILE_EXISTS}, status=409)

        return Response(serialize(releasefile, request.user), status=201)
