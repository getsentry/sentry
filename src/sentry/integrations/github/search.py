from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import Integration


class GitHubSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='github',
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
            repo = request.GET.get('repo')
            if repo is None:
                return Response({'detail': 'repo is a required parameter'}, status=400)

            try:
                response = installation.search_issues(
                    query=(u'repo:%s %s' % (repo, query)).encode('utf-8'),
                )
            except Exception as e:
                return self.handle_api_error(e)

            return Response([{
                'label': '#%s %s' % (i['number'], i['title']),
                'value': i['number']
            } for i in response.get('items', [])])

        if field == 'repo':

            if integration.metadata['account_type'] == 'User':
                query = (u'user:%s %s' % (integration.name, query)).encode('utf-8')
            else:
                query = (u'org:%s %s' % (integration.name, query)).encode('utf-8')

            try:
                response = installation.search_repositories(
                    query=query,
                )
            except Exception as e:
                return self.handle_api_error(e)

            return Response([{
                'label': i['name'],
                'value': i['full_name']
            } for i in response.get('items', [])])

        return Response(status=400)
