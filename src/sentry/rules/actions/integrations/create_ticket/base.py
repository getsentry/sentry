from __future__ import annotations

import abc
from collections.abc import Generator, Mapping
from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.rule import Rule
from sentry.rules.actions.integrations.base import IntegrationEventAction
from sentry.rules.actions.integrations.create_ticket.form import IntegrationNotifyServiceForm
from sentry.rules.actions.integrations.create_ticket.utils import create_issue
from sentry.rules.base import CallbackFuture


class TicketEventAction(IntegrationEventAction, abc.ABC):
    """Shared ticket actions"""

    integration_key = "integration"
    link: str | None
    rule: Rule

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super(IntegrationEventAction, self).__init__(*args, **kwargs)
        integration_choices = [
            (i.id, self.translate_integration(i)) for i in self.get_integrations()
        ]

        if not self.get_integration_id() and integration_choices:
            self.data = {**self.data, self.integration_key: integration_choices[0][0]}

        self.form_fields = {
            self.integration_key: {
                "choices": integration_choices,
                "initial": str(self.get_integration_id()),
                "type": "choice",
                "resetsForm": True,
                "updatesForm": True,
            }
        }

        dynamic_fields = self.get_dynamic_form_fields()
        if dynamic_fields:
            self.form_fields.update(dynamic_fields)

    def render_label(self) -> str:
        label: str = self.label.format(integration=self.get_integration_name())
        return label

    @property
    @abc.abstractmethod
    def ticket_type(self) -> str:
        pass

    @property
    def prompt(self) -> str:
        return f"Create {self.ticket_type}"

    def get_dynamic_form_fields(self) -> Mapping[str, Any] | None:
        """
        Either get the dynamic form fields cached on the DB return `None`.

        :return: (Option) Django form fields dictionary
        """
        form_fields: Mapping[str, Any] | list[Any] | None = self.data.get("dynamic_form_fields")
        if not form_fields:
            return None

        # Although this can be done with dict comprehension, looping for clarity.
        if isinstance(form_fields, list):
            fields = {}
            for field in form_fields:
                if "name" in field:
                    fields[field["name"]] = field
            return fields
        return form_fields

    def translate_integration(self, integration: RpcIntegration) -> str:
        name: str = integration.name
        return name

    @abc.abstractmethod
    def generate_footer(self, rule_url: str) -> str:
        pass

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        integration_id = self.get_integration_id()
        key = f"{self.provider}:{integration_id}"
        yield self.future(
            create_issue,
            key=key,
            data=self.data,
            generate_footer=self.generate_footer,
            integration_id=integration_id,
            provider=self.provider,
        )

    def get_form_instance(self) -> IntegrationNotifyServiceForm:
        return IntegrationNotifyServiceForm(self.data, integrations=self.get_integrations())
