from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.mediators import external_requests
from sentry.models import Project


class SentryAppInstallationExternalRequestsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request, installation):
        if not features.has('organizations:sentry-apps',
                            installation.organization,
                            actor=request.user):
            return Response(status=404)

        project_id = request.GET.get('projectId')
        if not project_id:
            return Response({'detail': 'projectId is required.'})

        try:
            project = Project.objects.get(
                id=project_id,
                organization_id=installation.organization_id,
            )
        except Project.DoesNotExist:
            return Response(status=404)

        options = external_requests.SelectRequester.run(
            install=installation,
            project=project,
            uri=request.GET.get('uri'),
        )

        return Response({'options': options})
