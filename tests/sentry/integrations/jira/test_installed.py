import jwt
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.atlassian_connect import get_query_hash
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.testutils.helpers.jwt import RS256_KEY, RS256_PUB_KEY
from sentry.utils.http import absolute_uri


class JiraInstalledTest(APITestCase):
    external_id = "it2may+cody"
    jira_signing_algorithm = "RS256"
    kid = "cudi"
    path = "/extensions/jira/installed/"

    def jwt_token(self):
        return jwt.encode(
            {
                "iss": self.external_id,
                "aud": absolute_uri(),
                "qsh": get_query_hash(self.path, method="POST", query_params={}),
            },
            RS256_KEY,
            algorithm=self.jira_signing_algorithm,
            headers={"kid": self.kid, "alg": self.jira_signing_algorithm},
        )

    @responses.activate
    def test_simple(self):
        responses.add(
            responses.GET,
            f"https://connect-install-keys.atlassian.com/{self.kid}",
            body=RS256_PUB_KEY,
        )

        resp = self.client.post(
            self.path,
            data={
                "jira": {
                    "metadata": {},
                    "external_id": self.external_id,
                },
                "clientKey": "limepie",
                "oauthClientId": "EFG",
                "publicKey": "yourCar",
                "sharedSecret": "garden",
                "baseUrl": "https://sentry.io.org.xyz.online.dev.sentry.io",
            },
            HTTP_AUTHORIZATION="JWT " + self.jwt_token(),
        )
        integration = Integration.objects.get(provider="jira", external_id=self.external_id)
        assert integration.status == ObjectStatus.VISIBLE
        assert resp.status_code == 200
