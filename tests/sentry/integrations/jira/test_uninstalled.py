from unittest.mock import MagicMock, patch

import jwt
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils.http import absolute_uri
from tests.sentry.utils.test_jwt import RS256_KEY, RS256_PUB_KEY


@control_silo_test
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

    @patch("sentry_sdk.set_tag")
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    def test_with_shared_secret(self, mock_bind_org_context: MagicMock, mock_set_tag: MagicMock):
        org = self.organization

        integration = self.create_provider_integration(
            provider="jira",
            status=ObjectStatus.ACTIVE,
            external_id=self.external_id,
            metadata={"shared_secret": self.shared_secret},
        )
        integration.add_organization(org, self.user)

        resp = self.client.post(
            self.path, data={}, HTTP_AUTHORIZATION="JWT " + self.jwt_token_secret()
        )
        # We have to pull this from the DB again to see the updated status
        integration = Integration.objects.get(id=integration.id)

        mock_set_tag.assert_any_call("integration_id", integration.id)
        with assume_test_silo_mode(SiloMode.REGION):
            mock_bind_org_context.assert_called_with(serialize_rpc_organization(org))
        assert integration.status == ObjectStatus.DISABLED
        assert resp.status_code == 200

    @patch("sentry_sdk.set_tag")
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    @responses.activate
    def test_with_key_id(self, mock_bind_org_context: MagicMock, mock_set_tag: MagicMock):
        org = self.organization

        integration = self.create_provider_integration(
            provider="jira", status=ObjectStatus.ACTIVE, external_id=self.external_id
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
        # We have to pull this from the DB again to see the updated status
        integration = Integration.objects.get(id=integration.id)

        mock_set_tag.assert_any_call("integration_id", integration.id)
        with assume_test_silo_mode(SiloMode.REGION):
            mock_bind_org_context.assert_called_with(serialize_rpc_organization(org))
        assert integration.status == ObjectStatus.DISABLED
        assert resp.status_code == 200
