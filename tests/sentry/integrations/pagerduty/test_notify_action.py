from __future__ import absolute_import

import responses

from sentry.utils import json
from sentry.models import Integration, PagerDutyService, GroupStatus
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.pagerduty.notify_action import PagerDutyNotifyServiceAction

# external_id is the account name in pagerduty
EXTERNAL_ID = "example-pagerduty"
SERVICES = [
    {
        "type": "service",
        "integration_key": "PND4F9",
        "service_id": "123",
        "service_name": "Critical",
    }
]


class PagerDutyNotifyActionTest(RuleTestCase):
    rule_cls = PagerDutyNotifyServiceAction

    def setUp(self):
        self.integration = Integration.objects.create(
            provider="pagerduty",
            name="Example",
            external_id=EXTERNAL_ID,
            metadata={"services": SERVICES},
        )
        self.integration.add_organization(self.organization, self.user)
        self.service = PagerDutyService.objects.create(
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
            organization_integration=self.integration.organizationintegration_set.first(),
        )
        self.installation = self.integration.get_installation(self.organization.id)

    @responses.activate
    def test_applies_correctly(self):
        event = self.get_event()

        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://events.pagerduty.com/v2/enqueue/",
            body={},
            status=202,
            content_type="application/json",
        )

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[0].request.body)

        assert data["event_action"] == "trigger"

    def test_render_label(self):
        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        assert (
            rule.render_label()
            == "Send a notification to PagerDuty account Example and service Critical"
        )

    def test_render_label_without_integration(self):
        self.integration.delete()

        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        label = rule.render_label()
        assert label == "Send a notification to PagerDuty account [removed] and service [removed]"

    @responses.activate
    def test_valid_service_selected(self):
        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        form = rule.get_form_instance()
        assert form.is_valid()

    @responses.activate
    def test_notifies_with_multiple_pd_accounts(self):
        # make another PagerDuty account and service for the same organization
        service_info = {
            "type": "service",
            "integration_key": "PND352",
            "service_id": "346",
            "service_name": "Informational",
        }
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example 3",
            external_id="example-3",
            metadata={"services": [service_info]},
        )
        integration.add_organization(self.organization, self.user)
        service = PagerDutyService.objects.create(
            service_name=service_info["service_name"],
            integration_key=service_info["integration_key"],
            organization_integration=integration.organizationintegration_set.first(),
        )
        self.installation = integration.get_installation(self.organization.id)

        event = self.get_event()

        rule = self.get_rule(data={"account": integration.id, "service": service.id})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://events.pagerduty.com/v2/enqueue/",
            body={},
            status=202,
            content_type="application/json",
        )

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[0].request.body)

        assert data["event_action"] == "trigger"

    @responses.activate
    def test_invalid_service_selected(self):
        # make a service associated with a different pagerduty account
        service_info = {
            "type": "service",
            "integration_key": "PND351",
            "service_id": "345",
            "service_name": "Informational",
        }
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example 2",
            external_id="example-2",
            metadata={"services": [service_info]},
        )
        integration.add_organization(self.organization, self.user)
        service = PagerDutyService.objects.create(
            service_name=service_info["service_name"],
            integration_key=service_info["integration_key"],
            organization_integration=integration.organizationintegration_set.first(),
        )
        self.installation = integration.get_installation(self.organization.id)

        rule = self.get_rule(data={"account": self.integration.id, "service": service.id})

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert len(form.errors) == 1

    def test_dont_notify_ignored(self):
        event = self.get_event()
        event.group.status = GroupStatus.IGNORED
        event.group.save()

        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 0
