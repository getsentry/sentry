from sentry.integrations.msteams import MsTeamsWebhookMixin


class TestIsNewIntegrationInstallationEvent:
    def test_valid_new_installation_event(self):
        data = {"type": "installationUpdate", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_valid_non_installation_event(self):
        data = {"type": "message", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_invalid_missing_type_field(self):
        data = {"action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_empty_input(self):
        data = {}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_only_required_fields(self):
        data = {"type": "installationUpdate"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_additional_fields(self):
        data = {"type": "installationUpdate", "action": "add", "extra": "field"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_minimum_input(self):
        data = {"type": "installationUpdate", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is True

    def test_invalid_event_type(self):
        data = {"type": "invalidType", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_invalid_action(self):
        data = {"type": "installationUpdate", "action": "remove"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False

    def test_different_event_type(self):
        data = {"type": "message", "action": "add"}
        assert MsTeamsWebhookMixin.is_new_integration_installation_event(data) is False
