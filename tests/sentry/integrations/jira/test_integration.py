from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase


class JiraSearchEndpointTest(APITestCase):
    def test_simple(self):
        org = self.organization
        self.login_as(self.user)
        group = self.create_group()

        integration = Integration.objects.create(
            provider='jira',
            name='Example JIRA',
        )
        integration.add_organization(org.id)

        installation = integration.get_installation()

        assert installation.get_link_issue_config(group) == [
            {
                'name': 'externalIssue',
                'label': 'Issue',
                'default': '',
                'type': 'string',
                'autocompleteUrl': reverse(
                    'sentry-extensions-jira-search', args=[org.slug, integration.id],
                )
            }
        ]
