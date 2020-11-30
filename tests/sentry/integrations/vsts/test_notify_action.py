from __future__ import absolute_import

import responses

from time import time

from sentry.utils import json
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.vsts.notify_action import AzureDevopsCreateTicketAction
from sentry.integrations.vsts.integration import VstsIntegration

from sentry.models import ExternalIssue, GroupLink, Identity, IdentityProvider, Integration, Rule

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
    def test_doesnt_create_issue(self):
        """Don't create an issue if one already exists on the event"""

        event = self.get_event()
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key="TEST#6",
            title=event.title,
            description="Fix this.",
        )
        GroupLink.objects.create(
            group_id=event.group.id,
            project_id=self.project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
            data={"provider": self.integration.model.provider},
        )
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

        results = list(azuredevops_rule.after(event=event, state=self.get_state()))
        assert len(results) == 1
        results[0].callback(event, futures=[])
        assert len(responses.calls) == 0
