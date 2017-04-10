from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import serializers

from sentry.api.base import DocSection
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.content_negotiation import ConditionalContentNegotiation
from sentry.api.permissions import SystemPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.models import ProjectDSymFile, create_files_from_macho_zip, \
    VersionDSymFile, DSymApp, DSYM_PLATFORMS

ERR_FILE_EXISTS = 'A file matching this uuid already exists'


class AssociateDsymSerializer(serializers.Serializer):
    checksums = ListField(child=serializers.CharField(max_length=40))
    platform = serializers.ChoiceField(choices=zip(
        DSYM_PLATFORMS.keys(), DSYM_PLATFORMS.keys(),
    ))
    name = serializers.CharField(max_length=250)
    appId = serializers.CharField(max_length=250)
    version = serializers.CharField(max_length=40)
    build = serializers.CharField(max_length=40)


def upload_from_request(request, project=None):
    if 'file' not in request.FILES:
        return Response({'detail': 'Missing uploaded file'}, status=400)
    fileobj = request.FILES['file']
    files = create_files_from_macho_zip(fileobj, project=project)
    return Response(serialize(files, request.user), status=201)


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
            dsym_app=apps
        ).select_related('projectdsymfile').order_by('-build', 'version')

        file_list = ProjectDSymFile.objects.filter(
            project=project,
            versiondsymfile__isnull=True,
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
        missing = ProjectDSymFile.objects.find_missing(checksums, project=project)
        return Response({'missing': missing})


class AssociateDSymFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    def post(self, request, project):
        serializer = AssociateDsymSerializer(data=request.DATA)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.object

        associated = []
        dsym_app = DSymApp.objects.create_or_update_app(
            sync_id=None,
            app_id=data['appId'],
            project=project,
            data={'name': data['name']},
            platform=DSYM_PLATFORMS[data['platform']],
        )
        dsym_files = ProjectDSymFile.objects.find_by_checksums(
            data['checksums'], project)

        for dsym_file in dsym_files:
            version_dsym_file, created = VersionDSymFile.objects.get_or_create(
                dsym_file=dsym_file,
                dsym_app=dsym_app,
                version=data['version'],
                build=data['build'],
            )
            if created:
                associated.append(dsym_file)

        return Response({
            'associatedDsymFiles': serialize(associated, request.user),
        })
