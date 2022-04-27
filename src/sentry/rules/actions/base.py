from __future__ import annotations

import abc
import logging
from typing import Any, Callable, Generator, Mapping, Sequence

from django import forms
from django.db.models import QuerySet
from rest_framework import serializers
from rest_framework.response import Response

from sentry.constants import SENTRY_APP_ACTIONS, ObjectStatus
from sentry.eventstore.models import Event
from sentry.integrations import IntegrationInstallation
from sentry.mediators import alert_rule_actions
from sentry.mediators.external_requests.alert_rule_action_requester import AlertRuleActionResult
from sentry.models import ExternalIssue, GroupLink, Integration, Project, SentryAppInstallation
from sentry.rules.base import CallbackFuture, EventState, RuleBase
from sentry.types.rules import RuleFuture

logger = logging.getLogger("sentry.rules")

INTEGRATION_KEY = "integration"


class IntegrationNotifyServiceForm(forms.Form):  # type: ignore
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super().__init__(*args, **kwargs)
        if integrations:
            self.fields[INTEGRATION_KEY].initial = integrations[0][0]

        self.fields[INTEGRATION_KEY].choices = integrations
        self.fields[INTEGRATION_KEY].widget.choices = self.fields[INTEGRATION_KEY].choices


class EventAction(RuleBase, abc.ABC):
    rule_type = "action/event"

    @abc.abstractmethod
    def after(self, event: Event, state: EventState) -> Generator[CallbackFuture, None, None]:
        """
        Executed after a Rule matches.

        Should yield CallBackFuture instances which will then be passed into
        the given callback.

        See the notification implementation for example usage.

        Does not need to handle group state (e.g. is resolved or not)
        Caller will handle state

        >>> def after(self, event, state):
        >>>     yield self.future(self.print_results)
        >>>
        >>> def print_results(self, event, futures):
        >>>     print('Got futures for Event {}'.format(event.id))
        >>>     for future in futures:
        >>>         print(future)
        """
        pass


class SentryAppEventAction(EventAction, abc.ABC):
    """Abstract class to ensure that actions in SENTRY_APP_ACTIONS have all required methods"""

    @abc.abstractmethod
    def get_custom_actions(self, project: Project) -> Sequence[Mapping[str, Any]]:
        pass

    @abc.abstractmethod
    def self_validate(self) -> None:
        pass


def trigger_sentry_app_action_creators_for_issues(
    actions: Sequence[Mapping[str, str]]
) -> str | None:
    created = None
    for action in actions:
        # Only call creator for Sentry Apps with UI Components for alert rules.
        if not action.get("id") in SENTRY_APP_ACTIONS:
            continue

        install = SentryAppInstallation.objects.get(uuid=action.get("sentryAppInstallationUuid"))
        result: AlertRuleActionResult = alert_rule_actions.AlertRuleActionCreator.run(
            install=install,
            fields=action.get("settings"),
        )
        # Bubble up errors from Sentry App to the UI
        if not result["success"]:
            raise serializers.ValidationError({"actions": [result["message"]]})
        created = "alert-rule-action"
    return created


class IntegrationEventAction(EventAction, abc.ABC):
    """Intermediate abstract class to help DRY some event actions code."""

    @property
    @abc.abstractmethod
    def prompt(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def provider(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def integration_key(self) -> str:
        pass

    def is_enabled(self) -> bool:
        enabled: bool = self.get_integrations().exists()
        return enabled

    def get_integration_name(self) -> str:
        """Get the integration's name for the label."""
        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            return "[removed]"

        _name: str = integration.name
        return _name

    def get_integrations(self) -> QuerySet[Integration]:
        query: QuerySet[Integration] = Integration.objects.get_active_integrations(
            self.project.organization.id
        ).filter(
            provider=self.provider,
        )
        return query

    def get_integration_id(self) -> str:
        integration_id: str = self.get_option(self.integration_key)
        return integration_id

    def get_integration(self) -> Integration:
        """
        Uses the required class variables `provider` and `integration_key` with
        RuleBase.get_option to get the integration object from DB.

        :raises: Integration.DoesNotExist
        :return: Integration
        """
        return Integration.objects.get_active_integrations(self.project.organization.id).get(
            id=self.get_integration_id(),
            provider=self.provider,
        )

    def get_installation(self) -> Any:
        return self.get_integration().get_installation(self.project.organization.id)

    def get_form_instance(self) -> forms.Form:
        return self.form_cls(self.data, integrations=self.get_integrations())


def create_link(
    integration: Integration,
    installation: IntegrationInstallation,
    event: Event,
    response: Response,
) -> None:
    """
    After creating the event on a third-party service, create a link to the
    external resource in the DB. TODO make this a transaction.
    :param integration: Integration object.
    :param installation: Installation object.
    :param event: The event object that was recorded on an external service.
    :param response: The API response from creating the new resource.
        - key: String. The unique ID of the external resource
        - metadata: Optional Object. Can contain `display_name`.
    """
    external_issue = ExternalIssue.objects.create(
        organization_id=event.group.project.organization_id,
        integration_id=integration.id,
        key=response["key"],
        title=event.title,
        description=installation.get_group_description(event.group, event),
        metadata=response.get("metadata"),
    )
    GroupLink.objects.create(
        group_id=event.group.id,
        project_id=event.group.project_id,
        linked_type=GroupLink.LinkedType.issue,
        linked_id=external_issue.id,
        relationship=GroupLink.Relationship.references,
        data={"provider": integration.provider},
    )


def build_description(
    event: Event,
    rule_id: int,
    installation: IntegrationInstallation,
    generate_footer: Callable[[str], str],
) -> str:
    """
    Format the description of the ticket/work item
    """
    project = event.group.project
    rule_url = f"/organizations/{project.organization.slug}/alerts/rules/{project.slug}/{rule_id}/"

    description: str = installation.get_group_description(event.group, event) + generate_footer(
        rule_url
    )
    return description


def create_issue(event: Event, futures: Sequence[RuleFuture]) -> None:
    """Create an issue for a given event"""
    organization = event.group.project.organization

    for future in futures:
        rule_id = future.rule.id
        data = future.kwargs.get("data")
        provider = future.kwargs.get("provider")
        integration_id = future.kwargs.get("integration_id")
        generate_footer = future.kwargs.get("generate_footer")

        try:
            integration = Integration.objects.get(
                id=integration_id,
                provider=provider,
                organizations=organization,
                status=ObjectStatus.VISIBLE,
            )
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        installation = integration.get_installation(organization.id)
        data["title"] = event.title
        data["description"] = build_description(event, rule_id, installation, generate_footer)

        if data.get("dynamic_form_fields"):
            del data["dynamic_form_fields"]

        if ExternalIssue.objects.has_linked_issue(event, integration):
            logger.info(
                f"{integration.provider}.rule_trigger.link_already_exists",
                extra={
                    "rule_id": rule_id,
                    "project_id": event.group.project.id,
                    "group_id": event.group.id,
                },
            )
            return
        response = installation.create_issue(data)
        create_link(integration, installation, event, response)


class TicketEventAction(IntegrationEventAction, abc.ABC):
    """Shared ticket actions"""

    form_cls = IntegrationNotifyServiceForm
    integration_key = "integration"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super(IntegrationEventAction, self).__init__(*args, **kwargs)
        integration_choices = [
            (i.id, self.translate_integration(i)) for i in self.get_integrations()
        ]

        if not self.get_integration_id() and integration_choices:
            self.data[self.integration_key] = integration_choices[0][0]

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

    def translate_integration(self, integration: Integration) -> str:
        name: str = integration.name
        return name

    @abc.abstractmethod
    def generate_footer(self, rule_url: str) -> str:
        pass

    def after(self, event: Event, state: EventState) -> Generator[CallbackFuture, None, None]:
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
