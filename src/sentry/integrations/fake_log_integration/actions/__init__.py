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
    prompt = "Enter a message to log"
    provider = "fake-log"
    integration_key = "wat"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "identifier": {"type": "string", "required": True},
        }

    def after(self, event: GroupEvent, notification_uuid: str | None = None):
        # We construct a future for the caller to eventually invoke
        def send_log(event: GroupEvent, futures: Sequence[RuleFuture]):
            client = FakeIntegrationClient(self.get_integration())
            # Tight coupling to the `data` object in the rule object.
            # post_process supplies this information as far as I can tell.
            identifier = self.get_option("identifier")
            client.log(
                event.message,
                target_identifier=identifier,
                notification_uuid=notification_uuid,
            )

        # Key is used for rudimentary deduping
        yield self.future(send_log, key=f"fake-log:{self.get_integration().id}")
