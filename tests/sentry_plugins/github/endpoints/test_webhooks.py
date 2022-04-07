from uuid import uuid4

from sentry.models import OrganizationOption
from sentry.testutils import APITestCase
from sentry_plugins.github.testutils import PUSH_EVENT_EXAMPLE


class WebhookTest(APITestCase):
    def test_get(self):
        project = self.project  # force creation

        url = f"/plugins/github/organizations/{project.organization.id}/webhook/"

        response = self.client.get(url)

        assert response.status_code == 405

    def test_unregistered_event(self):
        project = self.project  # force creation
        url = f"/plugins/github/organizations/{project.organization.id}/webhook/"

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_HUB_SIGNATURE="sha1=98196e70369945ffa6b248cf70f7dc5e46dff241",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def test_invalid_signature_event(self):
        project = self.project  # force creation

        url = f"/plugins/github/organizations/{project.organization.id}/webhook/"

        secret = "2d7565c3537847b789d6995dca8d9f84"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 401
