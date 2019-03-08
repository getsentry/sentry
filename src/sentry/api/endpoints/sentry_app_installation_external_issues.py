from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.mediators.external_issues import IssueLinkCreator
from sentry.models import Group


class SentryAppInstallationExternalIssuesEndpoint(SentryAppInstallationBaseEndpoint):
    def post(self, request, installation):
        if not features.has('organizations:sentry-apps',
                            installation.organization,
                            actor=request.user):
            return Response(status=404)

        group_id = request.DATA.get('groupId')
        if not group_id:
            Response({'detail': 'groupId is required'})

        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response(status=404)

        try:
            external_issue = IssueLinkCreator.run(
                install=installation,
                group=group,
                action=request.DATA.get('action'),
                fields=request.DATA.get('fields'),
                uri=request.DATA.get('uri'),
            )
        except Exception:
            return Response({'error': 'Error communicating with Sentry App service'}, status=400)

        return Response(serialize(external_issue))
