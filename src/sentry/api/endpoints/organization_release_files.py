from __future__ import absolute_import

import re
from django.db import IntegrityError, transaction
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import File, Release, ReleaseFile

ERR_FILE_EXISTS = 'A file matching this name already exists for the given release'
_filename_re = re.compile(r"[\n\t\r\f\v\\]")


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


class OrganizationReleaseFilesEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES
    content_negotiation_class = ConditionalContentNegotiation

    def get(self, request, organization, version):
        """
        List a Release's Files
        ``````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=organization.id,
                projects=self.get_allowed_projects(request, organization),
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

    def post(self, request, organization, version):
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
                organization_id=organization.id,
                projects=self.get_allowed_projects(request, organization),
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

        if _filename_re.search(name):
            return Response({'detail': 'File name must not contain special whitespace characters'}, status=400)

        headers = {
            'Content-Type': fileobj.content_type,
        }
        for headerval in request.DATA.getlist('header') or ():
            try:
                k, v = headerval.split(':', 1)
            except ValueError:
                return Response({'detail': 'header value was not formatted correctly'}, status=400)
            else:
                if _filename_re.search(v):
                    return Response({'detail': 'header value must not contain special whitespace characters'}, status=400)
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
                    organization_id=release.organization_id,
                    release=release,
                    file=file,
                    name=full_name,
                )
        except IntegrityError:
            file.delete()
            return Response({'detail': ERR_FILE_EXISTS}, status=409)

        return Response(serialize(releasefile, request.user), status=201)
