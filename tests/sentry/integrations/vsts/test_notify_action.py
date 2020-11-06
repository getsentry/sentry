from __future__ import absolute_import

import responses

from time import time

from sentry.models.integration import PagerDutyService
from sentry.utils import json
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.vsts.notify_action import AzureDevopsCreateTicketAction
from sentry.integrations.vsts.integration import VstsIntegration

from sentry.models import ExternalIssue, Identity, IdentityProvider, Integration, Rule

from .testutils import WORK_ITEM_RESPONSE


class AzureDevopsCreateTicketActionTest(RuleTestCase):
    rule_cls = AzureDevopsCreateTicketAction

    def setUp(self):
        model = Integration.objects.create(
            provider="vsts",
            external_id="vsts_external_id",
            name="fabrikam-fiber-inc",
            metadata={
                "domain_name": "https://fabrikam-fiber-inc.visualstudio.com/",
                "default_project": "0987654321",
            },
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="vsts", config={}),
            user=self.user,
            external_id="vsts",
            data={"access_token": "123456789", "expires": time() + 1234567},
        )
        model.add_organization(self.organization, self.user, identity.id)
        self.integration = VstsIntegration(model, self.organization.id)

    @responses.activate
    def test_create_issue(self):
        event = self.get_event()
        azuredevops_rule = self.get_rule(
            data={
                "title": "Hello",
                "description": "Fix this.",
                "project": "0987654321",
                "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
                "vsts_integration": self.integration.model.id,
            }
        )
        azuredevops_rule.rule = Rule.objects.create(project=self.project, label="test rule")
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/0987654321/_apis/wit/workitems/$Microsoft.VSTS.WorkItemTypes.Task?api-version=3.0",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        results = list(azuredevops_rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[0].response.text)

        assert data["fields"]["System.Title"] == "Hello"
        assert data["fields"]["System.Description"] == "Fix this."

        external_issue = ExternalIssue.objects.get(key="Fabrikam-Fiber-Git#309")
        assert external_issue

    @responses.activate
    def test_applies_correctly(self):
        event = self.get_event()

        rule = self.get_rule(data={"account": self.integration.id, "service": self.service.id})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://events.pagerduty.com/v2/enqueue/",
            json={},
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

    def test_valid_service_options(self):
        # create new org that has the same pd account but different a service added
        new_org = self.create_organization(name="New Org", owner=self.user)

        # need to create a new project and set it as self.project because rules are
        # project based and we want the project in this case to be associated with the
        # new organization when we call `self.get_rule()`
        new_project = self.create_project(name="new proj", organization=new_org)
        self.project = new_project

        self.integration.add_organization(new_org, self.user)
        oi = OrganizationIntegration.objects.get(organization=new_org)
        new_service = PagerDutyService.objects.create(
            service_name="New Service",
            integration_key="new_service_key",
            organization_integration=oi,
        )

        rule = self.get_rule(data={"account": self.integration.id})

        service_options = rule.get_services()
        assert service_options == [(new_service.id, new_service.service_name)]

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
            json={},
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
