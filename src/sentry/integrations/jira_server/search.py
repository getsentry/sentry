from __future__ import absolute_import

from sentry.integrations.jira.search import JiraSearchEndpoint
from sentry.models import Integration


class JiraServerSearchEndpoint(JiraSearchEndpoint):

    def _get_integration(self, organization, integration_id):
        return Integration.objects.get(
            organizations=organization,
            id=integration_id,
            provider='jira_server',
        )
