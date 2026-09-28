from typing import Any
from unittest import mock

from sentry.integrations.msteams import parsing
from sentry.integrations.services.integration import integration_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GetIntegrationFromRequestDataTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_provider_integration(
            provider="msteams",
            name="Fellowship of the Ring",
            external_id="f3ll0wsh1p",
        )

    def request_data(
        self,
        *,
        integration_id: int | None = None,
        team_id: str | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        channel_data: dict[str, Any] = {}
        if team_id is not None:
            channel_data["team"] = {"id": team_id}
        if tenant_id is not None:
            channel_data["tenant"] = {"id": tenant_id}

        data: dict[str, Any] = {"channelData": channel_data}
        if integration_id is not None:
            data["value"] = {"payload": {"integrationId": integration_id}}
        return data

    def test_resolves_from_card_action(self) -> None:
        data = self.request_data(integration_id=self.integration.id)

        integration = parsing.get_integration_from_request_data(data=data)

        assert integration is not None
        assert integration.id == self.integration.id

    def test_falls_back_to_channel_data(self) -> None:
        data = self.request_data(team_id="f3ll0wsh1p")

        integration = parsing.get_integration_from_request_data(data=data)

        assert integration is not None
        assert integration.id == self.integration.id

    def test_falls_back_to_tenant(self) -> None:
        self.integration.update(external_id="m17hr4nd1r")
        data = self.request_data(tenant_id="m17hr4nd1r")

        integration = parsing.get_integration_from_request_data(data=data)

        assert integration is not None
        assert integration.id == self.integration.id

    def test_returns_none_when_nothing_matches(self) -> None:
        data = self.request_data(team_id="m0rd0r", tenant_id="s4ur0n")

        assert parsing.get_integration_from_request_data(data=data) is None

    def test_can_infer_from_card_action(self) -> None:
        data = self.request_data(integration_id=self.integration.id)

        assert parsing.can_infer_integration(data=data) is True

    def test_can_infer_from_team_id(self) -> None:
        data = self.request_data(team_id="f3ll0wsh1p")

        assert parsing.can_infer_integration(data=data) is True

    def test_cannot_infer_from_tenant_id_alone(self) -> None:
        data = self.request_data(tenant_id="m17hr4nd1r")

        assert parsing.can_infer_integration(data=data) is False

    def test_cannot_infer_without_any_identifiers(self) -> None:
        assert parsing.can_infer_integration(data=self.request_data()) is False

    def test_can_infer_does_not_look_up_the_integration(self) -> None:
        # Every webhook request runs through this check before it can be shed, so it has to stay
        # a lookup-free inspection of the request body.
        data = self.request_data(integration_id=self.integration.id, team_id="f3ll0wsh1p")

        with mock.patch.object(integration_service, "get_integration") as mock_get_integration:
            assert parsing.can_infer_integration(data=data) is True

        assert not mock_get_integration.called
