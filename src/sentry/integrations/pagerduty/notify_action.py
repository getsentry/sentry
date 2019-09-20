"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import


from sentry import http
from sentry.utils import json

from sentry.rules.actions.base import EventAction
from sentry.models import Integration, PagerDutyServiceProject


class PagerDutyNotifyServiceAction(EventAction):
    label = "Send a notification to the PagerDuty"

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceAction, self).__init__(*args, **kwargs)

    def after(self, event, state):

        # extra = {"event_id": event.id}

        integration = Integration.objects.get(
            provider="pagerduty",
            organizations=self.project.organization,
        )
        service_project = PagerDutyServiceProject.objects.get(
            organization_integration__integration=integration,
            project_id=self.project.id,
        )

        def send_notification(event, futures):
            rules = [f.rule for f in futures]
            payload = {
                "routing_key": service_project.integration_key,
                "event_action": "trigger",
                "payload": {
                    "summary": "hell",
                    "severity": "info",
                    "source": "mlep",
                }
            }

            session = http.build_session()
            resp = session.post(
                "https://events.pagerduty.com/v2/enqueue",
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload),
                timeout=5,
            )
            resp.raise_for_status()
            resp = resp.json()

        key = u"pagerduty:{}".format(integration.id)
        yield self.future(send_notification, key=key)
