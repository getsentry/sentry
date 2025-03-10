from collections.abc import Sequence

from sentry.eventstore.models import GroupEvent
from sentry.integrations.fake_log_integration.actions.form import FakeLogServiceForm
from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.rules.actions.integrations.base import IntegrationEventAction
from sentry.types.rules import RuleFuture


# Our bread and butter for defining a new action
# This allows us to set up alert rules via the UI
class FakeLogAction(IntegrationEventAction):
    id = "sentry.integrations.fake_log.notify_action.FakeLogAction"
    label = "Log a message to {log_key} with identifier: {identifier}"
    prompt = "Enter a fake identifier to log alongside issue data"
    provider = "fake-log"
    integration_key = "log_key"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "identifier": {
                "type": "string",
                "required": True,
                "placeholder": "Enter logging identifier",
            },
            "log_key": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
        }

    def after(self, event: GroupEvent, notification_uuid: str | None = None):
        # Weird pattern as a result of the closure we create below.
        # We need integration information in both the closure and the future key.
        integration = self.get_integration()
        assert integration is not None, "Integration is required for fake log client"
        identifier = self.get_option("identifier", "damn")

        # We construct a future for the caller to eventually invoke, but for
        # whatever reason, we also supply a sequence of futures?
        def send_log(event: GroupEvent, futures: Sequence[RuleFuture]):
            client = FakeIntegrationClient(integration)
            # Unpacking the rule's data object happens here, so there's lots of
            # coupling to the provider's implementation here.
            # Also lots of coupling to the client, thereby bypassing the
            # integration installation class entirely. Doesn't feel great.
            client.log(
                event.message,
                target_identifier=identifier,
                notification_uuid=notification_uuid,
            )

        # Key is used for rudimentary deduping
        yield self.future(send_log, key=f"fake-log:{integration.id}")

    def render_label(self) -> str:
        identifier = self.get_option("identifier", "damn")
        log_key = self.get_option("log_key")
        label = f"Log a message to {log_key} with identifier: {identifier}"
        return label

    def get_form_instance(self) -> FakeLogServiceForm:
        return FakeLogServiceForm(
            self.data,
            integrations=self.get_integrations(),
        )
