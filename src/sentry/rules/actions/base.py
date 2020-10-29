from __future__ import absolute_import, print_function

from sentry.constants import ObjectStatus
from sentry.models.integration import Integration
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

    def get_integration(self):
        """
        Uses the required class variables `provider` and `integration_key` with
        RuleBase.get_option to get the integration object from DB.

        :raises: Integration.DoesNotExist
        :return: Integration
        """
        return Integration.objects.filter(
            id=self.get_option(self.integration_key),
            provider=self.provider,
            organizations=self.project.organization,
            status=ObjectStatus.VISIBLE,
        )

    def get_form_instance(self):
        return self.form_cls(self.data, integrations=self.get_integrations())
