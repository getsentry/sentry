from __future__ import absolute_import, print_function

from sentry.constants import ObjectStatus
from sentry.models.integration import Integration
from sentry.models import ExternalIssue, GroupLink
from sentry.rules.base import RuleBase


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


class TicketEventAction(IntegrationEventAction):
    """Shared ticket actions"""

    def generate_footer(self, rule_url):
        raise NotImplementedError

    def build_description(self, event, installation):
        """
        Format the description of the ticket/work item
        """
        rule_url = u"/organizations/{}/alerts/rules/{}/{}/".format(
            self.project.organization.slug, self.project.slug, self.rule.id
        )
        return installation.get_group_description(event.group, event) + self.generate_footer(
            rule_url
        )

    def has_linked_issue(self, event, integration):
        linked_issues = GroupLink.objects.filter(
            project_id=self.project.id,
            group_id=event.group.id,
            linked_type=GroupLink.LinkedType.issue,
        ).values_list("linked_id", flat=True)

        return ExternalIssue.objects.filter(
            id__in=linked_issues, integration_id=integration.id,
        ).exists()

    def create_link(self, key, integration, installation, event):
        external_issue = ExternalIssue.objects.create(
            organization_id=self.project.organization.id,
            integration_id=integration.id,
            key=key,
            title=event.title,
            description=installation.get_group_description(event.group, event),
        )
        GroupLink.objects.create(
            group_id=event.group.id,
            project_id=self.project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
            data={"provider": self.provider},
        )
