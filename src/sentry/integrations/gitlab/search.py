from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import Integration


class GitlabIssueSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='gitlab',
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get('field')
        query = request.GET.get('query')
        if field is None:
            return Response({'detail': 'field is a required parameter'}, status=400)
        if not query:
            return Response({'detail': 'query is a required parameter'}, status=400)

        installation = integration.get_installation(organization.id)

        if field == 'externalIssue':
            if not query:
                return Response([])

            response = installation.get_client().search_issues(installation.name, query)
            return Response(issues=[{
                'text': '(#%s) %s' % (i['number'], i['title']),
                'id': i['number']
            } for i in response.get('items', [])])

        return Response(status=400)
