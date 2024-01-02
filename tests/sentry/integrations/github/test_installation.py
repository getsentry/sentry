from unittest.mock import patch
from uuid import uuid4

import responses
from django.urls import reverse

from fixtures.github import INSTALLATION_API_RESPONSE, INSTALLATION_EVENT_EXAMPLE
from sentry import options
from sentry.integrations.github.installation import INSTALLATION_EXPOSURE_MAX_TIME
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import control_silo_test


@control_silo_test
class InstallationEndpointTest(APITestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        self.login_as(self.user)
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def test_installation_endpoint(self, get_jwt):
        # add installation via GitHub webhook
        responses.add(
            method=responses.GET,
            url="https://api.github.com/app/installations/2",
            body=INSTALLATION_API_RESPONSE,
            status=200,
            content_type="application/json",
        )

        response = self.client.post(
            path=self.url,
            data=INSTALLATION_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=348e46312df2901e8cb945616ee84ce30d9987c9",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

        # check for endpoint response
        installation_url = reverse("sentry-integration-github-installation", args=[2])
        response = self.client.get(installation_url)
        assert response.status_code == 200

        body = response.json()
        assert body["account"]["login"] == "octocat"
        assert body["account"]["type"] == "User"
        assert body["sender"]["id"] == 1
        assert body["sender"]["login"] == "octocat"

        # data should be hidden after exposure window
        with freeze_time(before_now(seconds=-INSTALLATION_EXPOSURE_MAX_TIME - 10)):
            response = self.client.get(installation_url)
            assert response.status_code == 404

    def test_no_installation(self):
        installation_url = reverse("sentry-integration-github-installation", args=[888])
        response = self.client.get(installation_url)
        assert response.status_code == 404
