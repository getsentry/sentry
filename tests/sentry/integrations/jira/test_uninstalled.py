import jwt
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.utils import get_query_hash
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri
from tests.sentry.utils.test_jwt import RS256_KEY, RS256_PUB_KEY


class JiraUninstalledTest(APITestCase):
    external_id = "it2may+cody"
    kid = "cudi"
    shared_secret = "garden"
    path = "/extensions/jira/uninstalled/"

    def jwt_token_secret(self):
        jira_signing_algorithm = "HS256"
        return jwt.encode(
            {
                "iss": self.external_id,
                "aud": absolute_uri(),
                "qsh": get_query_hash(self.path, method="POST", query_params={}),
            },
            self.shared_secret,
            algorithm=jira_signing_algorithm,
            headers={"alg": jira_signing_algorithm},
        )

    def jwt_token_cdn(self):
        jira_signing_algorithm = "RS256"
        return jwt.encode(
            {
                "iss": self.external_id,
                "aud": absolute_uri(),
                "qsh": get_query_hash(self.path, method="POST", query_params={}),
            },
            RS256_KEY,
            algorithm=jira_signing_algorithm,
            headers={"kid": self.kid, "alg": jira_signing_algorithm},
        )

    def test_with_shared_secret(self):
        org = self.organization

        integration = Integration.objects.create(
            provider="jira",
            status=ObjectStatus.VISIBLE,
            external_id=self.external_id,
            metadata={"shared_secret": self.shared_secret},
        )
        integration.add_organization(org, self.user)

        resp = self.client.post(
            self.path, data={}, HTTP_AUTHORIZATION="JWT " + self.jwt_token_secret()
        )
        integration = Integration.objects.get(id=integration.id)
        assert integration.status == ObjectStatus.DISABLED
        assert resp.status_code == 200

    @responses.activate
    def test_with_key_id(self):
        org = self.organization

        integration = Integration.objects.create(
            provider="jira", status=ObjectStatus.VISIBLE, external_id=self.external_id
        )
        integration.add_organization(org, self.user)

        responses.add(
            responses.GET,
            f"https://connect-install-keys.atlassian.com/{self.kid}",
            body=RS256_PUB_KEY,
        )

        resp = self.client.post(
            self.path, data={}, HTTP_AUTHORIZATION="JWT " + self.jwt_token_cdn()
        )
        integration = Integration.objects.get(id=integration.id)
        assert integration.status == ObjectStatus.DISABLED
        assert resp.status_code == 200
