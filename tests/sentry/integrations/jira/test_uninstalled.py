from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.constants import ObjectStatus
from sentry.models import Integration
from sentry.testutils import APITestCase


class JiraUninstalledTest(APITestCase):
    def test_simple(self):
        org = self.organization

        integration = Integration.objects.create(
            provider="jira", name="Example Jira", status=ObjectStatus.VISIBLE
        )
        integration.add_organization(org, self.user)

        path = "/extensions/jira/uninstalled/"

        with patch(
            "sentry.integrations.jira.uninstalled.get_integration_from_jwt",
            return_value=integration,
        ):
            resp = self.client.post(path, data={}, HTTP_AUTHORIZATION="JWT anexampletoken")
            integration = Integration.objects.get(id=integration.id)
            assert integration.status == ObjectStatus.DISABLED
            assert resp.status_code == 200
