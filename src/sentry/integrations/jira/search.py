from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.models import Integration


class JiraSearchEndpoint(IntegrationEndpoint):
    provider = 'jira'

    def _get_integration(self, organization, integration_id):
        return Integration.objects.get(
            organizations=organization,
            id=integration_id,
            provider=self.provider,
        )

    def _get_formatted_user(self, user):
        display = '%s %s(%s)' % (
            user.get('displayName', user['name']),
            '- %s ' % user.get('emailAddress') if user.get('emailAddress') else '',
            user['name'],
        )
        return {
            'value': user['name'],
            'label': display,
        }

    def get(self, request, organization, integration_id):
        try:
            integration = self._get_integration(organization, integration_id)
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
            try:
                resp = installation.search_issues(query)
            except IntegrationError as exc:
                return Response({'detail': exc.message}, status=400)
            return Response([{
                'label': '(%s) %s' % (i['key'], i['fields']['summary']),
                'value': i['key']
            } for i in resp.get('issues', [])])

        if field in ('assignee', 'reporter'):
            jira_client = installation.get_client()
            users = []
            try:
                response = jira_client.search_users_for_project(
                    request.GET.get('project', ''),
                    query
                )
            except (ApiUnauthorized, ApiError):
                return Response({'detail': 'Unable to fetch users from Jira'}, status=400)

            for user in response:
                if user.get('name'):
                    users.append(self._get_formatted_user(user))
            return Response(users)

        # TODO(jess): handle other autocomplete urls
        return Response(status=400)
