from time import time

import orjson
import responses

from fixtures.vsts import GET_PROJECTS_RESPONSE, WORK_ITEM_RESPONSE
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.vsts import AzureDevopsCreateTicketAction
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.models.grouplink import GroupLink
from sentry.models.rule import Rule
from sentry.silo.base import SiloMode
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.rules import RuleFuture

from .test_issues import VstsIssueBase

pytestmark = [requires_snuba]


@freeze_time()
class AzureDevopsCreateTicketActionTest(RuleTestCase, VstsIssueBase):
    rule_cls = AzureDevopsCreateTicketAction

    def setUp(self):
        integration, _, _, _ = self.create_identity_integration(
            user=self.user,
            organization=self.organization,
            integration_params={
                "provider": "vsts",
                "external_id": "vsts_external_id",
                "name": "fabrikam-fiber-inc",
                "metadata": {
                    "domain_name": "https://fabrikam-fiber-inc.visualstudio.com/",
                    "default_project": "0987654321",
                },
            },
            identity_params={
                "external_id": "vsts",
                "data": {"access_token": "123456789", "expires": time() + 1234567},
            },
        )
        self.integration = VstsIntegration(integration, self.organization.id)

    @responses.activate
    def test_create_issue(self):
        self.mock_categories("ac7c05bb-7f8e-4880-85a6-e08f37fd4a10")
        event = self.get_event()
        azuredevops_rule = self.get_rule(
            data={
                "title": "Hello",
                "description": "Fix this.",
                "project": "0987654321",
                "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
                "integration": self.integration.model.id,
            }
        )
        azuredevops_rule.rule = self.create_project_rule(project=self.project)
        responses.reset()
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/0987654321/_apis/wit/workitems/$Microsoft.VSTS.WorkItemTypes.Task",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        after_res = azuredevops_rule.after(event=event)
        results = list(after_res)
        assert len(results) == 1

        # Trigger rule callback
        rule_future = RuleFuture(rule=azuredevops_rule, kwargs=results[0].kwargs)
        results[0].callback(event, futures=[rule_future])
        data = orjson.loads(responses.calls[0].response.text)

        assert data["fields"]["System.Title"] == "Hello"
        assert data["fields"]["System.Description"] == "Fix this."

        external_issue = ExternalIssue.objects.get(key="309")
        assert external_issue

    @responses.activate
    def test_doesnt_create_issue(self):
        """Don't create an issue if one already exists on the event"""

        self.mock_categories("ac7c05bb-7f8e-4880-85a6-e08f37fd4a10")
        event = self.get_event()
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key="6",
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
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects?stateFilter=WellFormed&%24skip=0&%24top=100",
            body=GET_PROJECTS_RESPONSE,
            content_type="application/json",
        )
        azuredevops_rule = self.get_rule(
            data={
                "title": "Hello",
                "description": "Fix this.",
                "project": "0987654321",
                "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
                "integration": self.integration.model.id,
            }
        )
        azuredevops_rule.rule = Rule.objects.create(project=self.project, label="test rule")

        results = list(azuredevops_rule.after(event=event))
        assert len(results) == 1
        results[0].callback(event, futures=[])
        assert len(responses.calls) == 0

    def test_render_label(self):
        azuredevops_rule = self.get_rule(
            data={
                "integration": self.integration.model.id,
                "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
                "project": "0987654321",
                "dynamic_form_fields": {
                    "project": {
                        "name": "project",
                        "required": True,
                        "type": "choice",
                        "choices": [("ac7c05bb-7f8e-4880-85a6-e08f37fd4a10", "Fabrikam-Fiber-Git")],
                        "defaultValue": "ac7c05bb-7f8e-4880-85a6-e08f37fd4a10",
                        "label": "Project",
                        "placeholder": "ac7c05bb-7f8e-4880-85a6-e08f37fd4a10",
                        "updatesForm": True,
                    },
                    "work_item_type": {
                        "name": "work_item_type",
                        "required": True,
                        "type": "choice",
                        "choices": [
                            ("Microsoft.VSTS.WorkItemTypes.Issue", "Issue"),
                            ("Microsoft.VSTS.WorkItemTypes.Epic", "Epic"),
                            ("Microsoft.VSTS.WorkItemTypes.TestCase", "Test Case"),
                            ("Microsoft.VSTS.WorkItemTypes.SharedStep", "Shared Steps"),
                            ("Microsoft.VSTS.WorkItemTypes.SharedParameter", "Shared Parameter"),
                            (
                                "Microsoft.VSTS.WorkItemTypes.CodeReviewRequest",
                                "Code Review Request",
                            ),
                            (
                                "Microsoft.VSTS.WorkItemTypes.CodeReviewResponse",
                                "Code Review Response",
                            ),
                            ("Microsoft.VSTS.WorkItemTypes.FeedbackRequest", "Feedback Request"),
                            ("Microsoft.VSTS.WorkItemTypes.FeedbackResponse", "Feedback Response"),
                            ("Microsoft.VSTS.WorkItemTypes.TestPlan", "Test Plan"),
                            ("Microsoft.VSTS.WorkItemTypes.TestSuite", "Test Suite"),
                            ("Microsoft.VSTS.WorkItemTypes.Task", "Task"),
                        ],
                        "defaultValue": "Microsoft.VSTS.WorkItemTypes.Issue",
                        "label": "Work Item Type",
                        "placeholder": "Bug",
                    },
                },
            }
        )

        assert (
            azuredevops_rule.render_label()
            == """Create an Azure DevOps work item in fabrikam-fiber-inc with these """
        )

    def test_render_label_without_integration(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="vsts",
            external_id="vsts:2",
        )
        deleted_id = integration.id
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.delete()

        rule = self.get_rule(data={"integration": deleted_id})

        assert rule.render_label() == "Create an Azure DevOps work item in [removed] with these "
