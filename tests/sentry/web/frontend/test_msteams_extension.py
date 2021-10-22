from unittest.mock import patch

from django.core.signing import SignatureExpired

from sentry.models import OrganizationMember
from sentry.testutils import TestCase
from sentry.utils.signing import sign
from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView


class MsTeamsExtensionConfigurationTest(TestCase):
    def hit_configure(self, params):
        self.login_as(self.user)
        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org, role="admin")
        path = "/extensions/msteams/configure/"
        return self.client.get(path, params)

    def test_map_params(self):
        config_view = MsTeamsExtensionConfigurationView()
        data = {"my_param": "test"}
        signed_data = sign(**data)
        params = {"signed_params": signed_data}
        assert data == config_view.map_params_to_state(params)

    @patch("sentry.web.frontend.msteams_extension_configuration.unsign")
    def test_expired_signature(self, mock_unsign):
        with self.feature({"organizations:integrations-alert-rule": True}):
            mock_unsign.side_effect = SignatureExpired()
            resp = self.hit_configure({"signed_params": "test"})
            assert b"Installation link expired" in resp.content

    def test_no_team_plan_feature_flag(self):
        with self.feature(
            {
                "organizations:integrations-alert-rule": False,
                "organizations:integrations-chat-unfurl": False,
            }
        ):
            resp = self.hit_configure({"signed_params": "test"})
            assert resp.status_code == 302
            assert "/extensions/msteams/link/" in resp.url
