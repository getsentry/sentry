import logging

from django import forms

from sentry.constants import ObjectStatus
from sentry.models import ExternalIssue, GroupLink
from sentry.models.integration import Integration
from sentry.rules.base import RuleBase

logger = logging.getLogger("sentry.rules")

INTEGRATION_KEY = "integration"


class IntegrationNotifyServiceForm(forms.Form):
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(forms.Form, self).__init__(*args, **kwargs)
        if integrations:
            self.fields[INTEGRATION_KEY].initial = integrations[0][0]

        self.fields[INTEGRATION_KEY].choices = integrations
        self.fields[INTEGRATION_KEY].widget.choices = self.fields[INTEGRATION_KEY].choices


class EventAction(RuleBase):
    rule_type = "action/event"

    def after(self, event, state):
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
        raise NotImplementedError


class IntegrationEventAction(EventAction):
    """
    Intermediate abstract class to help DRY some event actions code.
    """

    def is_enabled(self):
        return self.get_integrations().exists()

    def get_integration_name(self):
        """
        Get the integration's name for the label.

        :return: string
        """
        try:
            return self.get_integration().name
        except Integration.DoesNotExist:
            return "[removed]"

    def get_integrations(self):
        return Integration.objects.filter(
            provider=self.provider,
            organizations=self.project.organization,
            status=ObjectStatus.VISIBLE,
        )

    def get_integration_id(self):
        return self.get_option(self.integration_key)

    def get_integration(self):
        """
        Uses the required class variables `provider` and `integration_key` with
        RuleBase.get_option to get the integration object from DB.

        :raises: Integration.DoesNotExist
        :return: Integration
        """
        return Integration.objects.get(
            id=self.get_integration_id(),
            provider=self.provider,
            organizations=self.project.organization,
            status=ObjectStatus.VISIBLE,
        )

    def get_installation(self):
        return self.get_integration().get_installation(self.project.organization.id)

    def get_form_instance(self):
        return self.form_cls(self.data, integrations=self.get_integrations())


def _linked_issues(event, integration):
    return ExternalIssue.objects.filter(
        id__in=GroupLink.objects.filter(
            project_id=event.group.project_id,
            group_id=event.group.id,
            linked_type=GroupLink.LinkedType.issue,
        ).values_list("linked_id", flat=True),
        integration_id=integration.id,
    )


def get_linked_issue_ids(event, integration):
    return _linked_issues(event, integration).values_list("key", flat=True)


def has_linked_issue(event, integration):
    return _linked_issues(event, integration).exists()


def create_link(integration, installation, event, response):
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


def build_description(event, rule_id, installation, generate_footer):
    """
    Format the description of the ticket/work item
    """
    project = event.group.project
    rule_url = f"/organizations/{project.organization.slug}/alerts/rules/{project.slug}/{rule_id}/"

    return installation.get_group_description(event.group, event) + generate_footer(rule_url)


def create_issue(event, futures):
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

        if has_linked_issue(event, integration):
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


class TicketEventAction(IntegrationEventAction):
    """Shared ticket actions"""

    form_cls = IntegrationNotifyServiceForm

    def __init__(self, *args, **kwargs):
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

    def render_label(self):
        return self.label.format(integration=self.get_integration_name())

    def get_dynamic_form_fields(self):
        """
        Either get the dynamic form fields cached on the DB return `None`.

        :return: (Option) Django form fields dictionary
        """
        form_fields = self.data.get("dynamic_form_fields")
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

    def translate_integration(self, integration):
        return integration.name

    @property
    def prompt(self):
        return f"Create {self.ticket_type}"

    def generate_footer(self, rule_url):
        raise NotImplementedError

    def after(self, event, state):
        integration_id = self.get_integration_id()
        key = f"{self.provider}:{integration_id}"
        return self.future(
            create_issue,
            key=key,
            data=self.data,
            generate_footer=self.generate_footer,
            integration_id=integration_id,
            provider=self.provider,
        )
