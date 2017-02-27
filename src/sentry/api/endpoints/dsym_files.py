from __future__ import absolute_import

from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.permissions import SystemPermission
from sentry.api.serializers import serialize
from sentry.models import ProjectDSymFile, create_files_from_macho_zip, \
    find_missing_dsym_files, VersionDSymFile, DSymApp

ERR_FILE_EXISTS = 'A file matching this uuid already exists'


def upload_from_request(request, project=None):
    if 'file' not in request.FILES:
        return Response({'detail': 'Missing uploaded file'}, status=400)
    fileobj = request.FILES['file']
    files = create_files_from_macho_zip(fileobj, project=project)
    return Response(serialize(files, request.user), status=201)


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


class DSymFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    content_negotiation_class = ConditionalContentNegotiation

    def get(self, request, project):
        """
        List a Project's DSym Files
        ```````````````````````````

        Retrieve a list of dsym files for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     dsym files of.
        :auth: required
        """

        apps = DSymApp.objects.filter(
            project=project
        )
        dsym_files = VersionDSymFile.objects.filter(
            app=apps
        ).select_related('projectdsymfile').order_by('-build', 'version')

        file_list = ProjectDSymFile.objects.filter(
            project=project,
            dsymfile__isnull=True,
        ).select_related('file')[:100]

        return Response({
            'apps': serialize(list(apps)),
            'debugSymbols': serialize(list(dsym_files)),
            'unreferencedDebugSymbols': serialize(list(file_list)),
        })

    def post(self, request, project):
        """
        Upload a New Files
        ``````````````````

        Upload a new dsym file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The file uploaded is a zip archive of a Apple .dSYM folder which
        contains the individual debug images.  Uploading through this endpoint
        will create different files for the contained images.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :param file file: the multipart encoded file.
        :auth: required
        """
        return upload_from_request(request, project=project)


class GlobalDSymFilesEndpoint(Endpoint):
    permission_classes = (SystemPermission,)

    def post(self, request):
        return upload_from_request(request, project=None)


class UnknownDSymFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project):
        checksums = request.GET.getlist('checksums')
        missing = find_missing_dsym_files(checksums, project=project)
        return Response({'missing': missing})


class UnknownGlobalDSymFilesEndpoint(Endpoint):
    permission_classes = (SystemPermission,)

    def get(self, request):
        checksums = request.GET.getlist('checksums')
        missing = find_missing_dsym_files(checksums, project=None)
        return Response({'missing': missing})
