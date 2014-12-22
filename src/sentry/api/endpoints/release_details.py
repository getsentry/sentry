from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection, Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Release


class ReleaseDetailsEndpoint(Endpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, release_id):
        """
        Retrieve an release

        Return details on an individual release.

            {method} {path}

        """
        release = Release.objects.get(id=release_id)

        assert_perm(release, request.user, request.auth)

        return Response(serialize(release, request.user))
