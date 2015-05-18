from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import File, Release, ReleaseFile


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

    def get(self, request, project, version):
        """
        List a release's files

        Retrieve a list of files for a given release.

            {method} {path}

        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        file_list = list(ReleaseFile.objects.filter(
            release=release,
        ).select_related('file').order_by('name'))

        return Response(serialize(file_list, request.user))

    def post(self, request, project, version):
        """
        Upload a new file

        Upload a new file for the given release.

            {method} {path}
            name=http%3A%2F%2Fexample.com%2Fapplication.js
            &header=X-SourceMap%3A%20http%3A%2F%2Fexample.com%2Fapplication.js.map

            # ...

        Unlike other API requests, files must be uploaded using the traditional
        multipart/form-data content-type.

        The optional 'name' attribute should reflect the absolute path that this
        file will be referenced as. For example, in the case of JavaScript you
        might specify the full web URI.
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

        # TODO(dcramer): File's are unique on (name, checksum) so we need to
        # ensure that this file does not already exist for other purposes
        file = File(
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
            return Response(status=409)

        return Response(serialize(releasefile, request.user), status=201)
