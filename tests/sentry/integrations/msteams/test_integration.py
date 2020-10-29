from __future__ import absolute_import


import responses

from six.moves.urllib.parse import urlencode


from sentry.integrations.msteams import MsTeamsIntegrationProvider
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.utils.compat.mock import patch
from sentry.utils.signing import sign


team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"


class MsTeamsIntegrationTest(IntegrationTestCase):
    provider = MsTeamsIntegrationProvider

    def setUp(self):
        super(MsTeamsIntegrationTest, self).setUp()
        self.start_time = 1594768808
        self.pipeline_state = {
            "team_id": team_id,
            "service_url": "https://smba.trafficmanager.net/amer/",
            "team_name": "my_team",
        }

    def assert_setup_flow(self):
        responses.reset()

        responses.add(
            responses.POST,
            u"https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

        with patch("time.time") as mock_time:
            mock_time.return_value = self.start_time
            # token mock
            access_json = {"expires_in": 86399, "access_token": "my_token"}
            responses.add(
                responses.POST,
                "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
                json=access_json,
            )

            params = {"signed_params": sign(**self.pipeline_state)}

            self.pipeline.bind_state(self.provider.key, self.pipeline_state)
            resp = self.client.get(self.setup_path, params)

            body = responses.calls[0].request.body
            assert body == urlencode(
                {
                    "client_id": "msteams-client-id",
                    "client_secret": "msteams-client-secret",
                    "grant_type": "client_credentials",
                    "scope": "https://api.botframework.com/.default",
                }
            )

            assert resp.status_code == 200
            self.assertDialogSuccess(resp)

            integration = Integration.objects.get(provider=self.provider.key)

            assert integration.external_id == team_id
            assert integration.name == "my_team"
            assert integration.metadata == {
                "access_token": "my_token",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "expires_at": self.start_time + 86399 - 60 * 5,
            }
            assert OrganizationIntegration.objects.get(
                integration=integration, organization=self.organization
            )

            integration_url = u"organizations/{}/rules/".format(self.organization.slug)
            assert integration_url in responses.calls[1].request.body.decode("utf-8")
            assert self.organization.name in responses.calls[1].request.body.decode("utf-8")

    @responses.activate
    def test_installation(self):
        self.assert_setup_flow()
