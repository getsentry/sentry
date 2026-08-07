import base64
from unittest.mock import patch

import jwt
from django.test.utils import override_settings

from sentry.conduit.channel import CONDUIT_CHANNEL_NAMESPACE, channel_id_for_seer_run
from sentry.seer.models.run import SeerRunMirrorStatus, SeerRunType
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from tests.sentry.utils.test_jwt import RS256_KEY

RS256_KEY_B64 = base64.b64encode(RS256_KEY.encode()).decode()

CONDUIT_SETTINGS = {
    "CONDUIT_GATEWAY_PRIVATE_KEY": RS256_KEY_B64,
    "CONDUIT_GATEWAY_JWT_ISSUER": "sentry",
    "CONDUIT_GATEWAY_JWT_AUDIENCE": "conduit",
    "CONDUIT_GATEWAY_URL": "https://conduit.example.com",
}

FEATURE = "organizations:seer-explorer-conduit"
SEER_RUN_STATE_ID = 4242


@cell_silo_test
class OrganizationSeerExplorerStreamCredentialsTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-explorer-stream-credentials"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.run = self.create_seer_run(
            user_id=self.user.id,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=SEER_RUN_STATE_ID,
            mirror_status=SeerRunMirrorStatus.LIVE,
        )

    def _post(self, run_id: object | None = None, **kwargs):
        return self.get_response(
            self.organization.slug,
            str(run_id if run_id is not None else SEER_RUN_STATE_ID),
            **kwargs,
        )


@cell_silo_test
class TestCredentialShape(OrganizationSeerExplorerStreamCredentialsTest):
    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_returns_conduit_client_shape(self, mock_access) -> None:
        """conduit-client reads exactly {conduit: {token, channel_id, url}}."""
        mock_access.return_value = (True, None)

        response = self._post()

        assert response.status_code == 201, response.data
        conduit = response.data["conduit"]
        assert set(conduit) == {"token", "channel_id", "url"}
        assert conduit["url"] == f"https://conduit.example.com/events/{self.organization.id}"

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_channel_is_derived_from_the_run(self, mock_access) -> None:
        """The browser must land on the channel Seer already publishes to, and
        return to it after a reconnect -- so this cannot be freshly minted."""
        mock_access.return_value = (True, None)

        first = self._post()
        second = self._post()

        expected = channel_id_for_seer_run(SEER_RUN_STATE_ID)
        assert str(first.data["conduit"]["channel_id"]) == expected
        assert str(second.data["conduit"]["channel_id"]) == expected

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_token_claims_bind_org_and_channel(self, mock_access) -> None:
        """These claims are the authorization boundary: Conduit's gateway serves any
        channel to whoever holds a token matching it."""
        mock_access.return_value = (True, None)

        response = self._post()

        claims = jwt.decode(
            response.data["conduit"]["token"],
            RS256_KEY,
            algorithms=["RS256"],
            audience="conduit",
            options={"verify_signature": False},
        )
        assert claims["org_id"] == self.organization.id
        assert claims["channel_id"] == channel_id_for_seer_run(SEER_RUN_STATE_ID)
        assert claims["iss"] == "sentry"
        assert claims["aud"] == "conduit"

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_accepts_run_uuid(self, mock_access) -> None:
        """The frontend holds a uuid for mirrored runs, a numeric id otherwise."""
        mock_access.return_value = (True, None)

        response = self._post(run_id=self.run.uuid)

        assert response.status_code == 201, response.data
        assert str(response.data["conduit"]["channel_id"]) == channel_id_for_seer_run(
            SEER_RUN_STATE_ID
        )


@cell_silo_test
class TestAuthorization(OrganizationSeerExplorerStreamCredentialsTest):
    """Streaming must not widen access beyond what polling already allows."""

    @override_settings(**CONDUIT_SETTINGS)
    def test_404_without_feature(self) -> None:
        assert self._post().status_code == 404

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch("sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_access_with_detail")
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_403_without_seer_access(self, mock_agent_access, mock_seer_access) -> None:
        mock_agent_access.return_value = (False, "no access")
        mock_seer_access.return_value = (False, "no access")

        assert self._post().status_code == 403

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_cannot_stream_another_orgs_run(self, mock_access) -> None:
        """A token for another org's run would let its agent output be read."""
        mock_access.return_value = (True, None)
        other_org = self.create_organization(owner=self.create_user())
        other_run = self.create_seer_run(
            organization=other_org,
            type=SeerRunType.EXPLORER,
            seer_run_state_id=9999,
            mirror_status=SeerRunMirrorStatus.LIVE,
        )

        response = self._post(run_id=other_run.uuid)

        assert response.status_code == 404
        assert "conduit" not in response.data

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_rejects_malformed_run_id(self, mock_access) -> None:
        mock_access.return_value = (True, None)

        assert self._post(run_id="not-a-run").status_code == 400

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    def test_401_when_not_logged_in(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()

        assert self._post().status_code == 401


@cell_silo_test
class TestUnavailableStates(OrganizationSeerExplorerStreamCredentialsTest):
    """Every one of these leaves the client polling, which is the product today."""

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_run_still_mirroring_has_nothing_to_stream(self, mock_access) -> None:
        mock_access.return_value = (True, None)
        pending = self.create_seer_run(
            type=SeerRunType.EXPLORER,
            seer_run_state_id=None,
            mirror_status=SeerRunMirrorStatus.PENDING,
        )

        response = self._post(run_id=pending.uuid)

        assert response.status_code == 200
        assert "conduit" not in response.data

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_failed_run_has_nothing_to_stream(self, mock_access) -> None:
        mock_access.return_value = (True, None)
        failed = self.create_seer_run(
            type=SeerRunType.EXPLORER,
            seer_run_state_id=None,
            mirror_status=SeerRunMirrorStatus.FAILED,
        )

        response = self._post(run_id=failed.uuid)

        assert response.status_code == 200
        assert "conduit" not in response.data

    @override_settings(CONDUIT_GATEWAY_PRIVATE_KEY=None)
    @with_feature(FEATURE)
    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_stream.has_seer_agent_access_with_detail"
    )
    def test_503_when_conduit_unconfigured(self, mock_access) -> None:
        """Not something the user can act on, and not fatal -- they keep polling."""
        mock_access.return_value = (True, None)

        response = self._post()

        assert response.status_code == 503
        assert "conduit" not in response.data


class TestChannelDerivation:
    def test_is_deterministic(self) -> None:
        assert channel_id_for_seer_run(42) == channel_id_for_seer_run(42)

    def test_differs_per_run(self) -> None:
        assert channel_id_for_seer_run(42) != channel_id_for_seer_run(43)

    def test_matches_seer(self) -> None:
        """Pin the wire constant.

        Seer derives the same channel from the same seed in its own
        src/seer/conduit/channel.py. If either side's namespace changes, in-flight
        runs break silently at deploy: Sentry hands the browser one channel while
        Seer publishes to another.
        """
        assert str(CONDUIT_CHANNEL_NAMESPACE) == "6f1a8f5e-3e9a-4a52-9b3b-2f0b6a7c1d84"
        assert channel_id_for_seer_run(42) == "adc8e72a-111f-521d-bfab-44f3308a7b2e"
