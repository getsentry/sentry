from collections.abc import Sequence

from sentry.eventstore.models import GroupEvent
from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.rules.actions.integrations.base import IntegrationEventAction
from sentry.types.rules import RuleFuture


# Our bread and butter for defining a new action
# This allows us to set up alert rules via the UI
class FakeLogAction(IntegrationEventAction):
    id = "sentry.integrations.fake_log_integration.actions.FakeLogAction"
    label = "Log a message"
    prompt = "Enter a fake identifier to log alongside issue data"
    provider = "fake-log"
    integration_key = "fake-log"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "identifier": {"type": "string", "required": True},
        }

    def after(self, event: GroupEvent, notification_uuid: str | None = None):
        # Weird pattern as a result of the closure we create below.
        # We need integration information in both the closure and the future key.
        integration = self.get_integration()
        assert integration is not None, "Integration is required for fake log client"

        # We construct a future for the caller to eventually invoke, but for
        # whatever reason, we also supply a sequence of futures?
        def send_log(event: GroupEvent, futures: Sequence[RuleFuture]):
            client = FakeIntegrationClient(integration)
            # Unpacking the rule's data object happens here, so there's lots of
            # coupling to the provider's implementation here.
            # Also lots of coupling to the client, thereby bypassing the
            # integration installation class entirely. Doesn't feel great.
            identifier = self.get_option("identifier")
            client.log(
                event.message,
                target_identifier=identifier,
                notification_uuid=notification_uuid,
            )

        # Key is used for rudimentary deduping
        yield self.future(send_log, key=f"fake-log:{integration.id}")
