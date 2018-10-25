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
        if query is None:
            return Response({'detail': 'query is a required parameter'}, status=400)

        installation = integration.get_installation(organization.id)

        if field == 'externalIssue':
            response = installation.search_issues(query)
            return Response([{
                'label': '(#%s) %s' % (i['iid'], i['title']),
                'value': '%s#%s' % (i['project_id'], i['iid'])
            } for i in response])

        if field == 'project':
            response = installation.search_projects(query)
            return Response([{
                'label': project['name_with_namespace'],
                'value': project['id'],
            } for project in response])

        return Response({'detail': 'invalid field value'}, status=400)
