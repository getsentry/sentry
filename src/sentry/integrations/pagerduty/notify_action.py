"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

from sentry.constants import ObjectStatus

from sentry.rules.actions.base import EventAction
from sentry.models import Integration, PagerDutyServiceProject
from .client import PagerDutyClient


class PagerDutyNotifyServiceAction(EventAction):
    label = "Send a notification to PagerDuty"

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceAction, self).__init__(*args, **kwargs)

    def after(self, event, state):
        try:
            integration = Integration.objects.get(
                provider="pagerduty",
                organizations=self.project.organization,
                status=ObjectStatus.VISIBLE,
            )
        except Integration.DoesNotExist:
            # integration removed but rule still exists
            return

        try:
            service_project = PagerDutyServiceProject.objects.get(
                organization_integration__integration=integration,
                project_id=self.project.id,
            )
        except PagerDutyServiceProject.DoesNotExist:
            # pagerduty service is not mapped to any sentry project
            # must be done when configuring the integration
            return

        def send_notification(event, futures):
            client = PagerDutyClient(integration_key=service_project.integration_key)
            client.send_trigger(event)

        key = u"pagerduty:{}".format(integration.id)
        yield self.future(send_notification, key=key)
