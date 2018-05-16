from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import Integration


class JiraSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='jira',
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get('field')
        query = request.GET.get('query')
        if field is None:
            return Response({'detail': 'field is a required parameter'}, status=400)
        if not query:
            return Response({'detail': 'query is a required parameter'}, status=400)

        installation = integration.get_installation()

        if field == 'issue_id':
            resp = installation.search_issues(query)
            return Response([{
                'text': '(%s) %s' % (i['key'], i['fields']['summary']),
                'id': i['key']
            } for i in resp.get('issues', [])])

        # TODO(jess): handle other autocomplete urls
        return Response(status=400)
