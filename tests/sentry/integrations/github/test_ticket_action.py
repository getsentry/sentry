from unittest.mock import MagicMock, patch

import pytest
import responses
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.integrations.github import client
from sentry.integrations.github.actions.create_ticket import GitHubCreateTicketAction
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.action_log.types import SYSTEM_ACTOR, ActionSource, CreateExternalIssueAction
from sentry.models.activity import Activity
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.rules.actions.integrations.create_ticket.utils import _get_external_issue_trigger
from sentry.services.eventstore.models import GroupEvent
from sentry.silo.base import SiloMode
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.action_log import capture_action_log
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.rules import RuleFuture

pytestmark = [requires_snuba]


class GitHubTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = GitHubCreateTicketAction
    repo = "foo/bar"
    assignee = "sentry_user"
    labels = ["bug", "invalid"]
    issue_num = 1

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github",
            external_id="1",
            metadata={
                "domain_name": "github.com/foo",
                "verify_ssl": True,
            },
        )

        self.installation = get_installation_of_type(
            GitHubIntegration, self.integration, self.organization.id
        )

        self.login_as(user=self.user)

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2099-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

    @pytest.fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    def trigger(self, event, rule_object):
        action = rule_object.data.get("actions", ())[0]
        action_inst = self.get_rule(data=action, rule=rule_object)
        results = list(action_inst.after(event=event))
        assert len(results) == 1

        rule_future = RuleFuture(rule=rule_object, kwargs=results[0].kwargs)
        return results[0].callback(event, futures=[rule_future])

    def get_key(self, event: GroupEvent):
        return ExternalIssue.objects.get_linked_issues(event, self.integration).values_list(
            "key", flat=True
        )[0]

    @responses.activate()
    def test_trigger_reference_prefers_the_legacy_issue_alert(self) -> None:
        rule = Rule(id=789, label="Escalating issues")
        future = RuleFuture(
            rule=rule,
            kwargs={"data": {"legacy_rule_id": 123, "workflow_id": 456}},
        )

        assert _get_external_issue_trigger(future) == {
            "type": "issue_alert",
            "id": "123",
            "name": "Escalating issues",
        }

    @responses.activate()
    def test_trigger_reference_uses_the_workflow_without_a_legacy_alert(self) -> None:
        rule = Rule(id=789, label="Escalating issues")
        future = RuleFuture(rule=rule, kwargs={"data": {"workflow_id": 456}})

        assert _get_external_issue_trigger(future) == {
            "type": "workflow",
            "id": "456",
            "name": "Escalating issues",
        }

    @responses.activate()
    @patch("sentry.sentry_apps.tasks.sentry_apps.build_external_issue_webhook.delay")
    def test_ticket_rules(self, build_external_issue_webhook: MagicMock) -> None:
        title = "sample title"
        sample_description = "sample bug report"
        html_url = f"https://github.com/foo/bar/issues/{self.issue_num}"

        sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.external_issue_created"]
        )
        self.create_sentry_app_installation(organization=self.organization, slug=sentry_app.slug)

        with assume_test_silo_mode(SiloMode.CELL):
            Repository.objects.create(
                name=self.repo,
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            method=responses.POST,
            url="https://api.github.com/repos/foo/bar/issues",
            json={
                "number": self.issue_num,
                "title": title,
                "body": sample_description,
                "html_url": html_url,
            },
            status=200,
        )
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/foo/bar/issues/{self.issue_num}",
            json={
                "number": "1",
                "title": title,
                "body": sample_description,
                "html_url": html_url,
            },
            status=200,
        )

        # Create a new Rule
        response = self.client.post(
            reverse(
                "sentry-api-0-project-rules",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                },
            ),
            format="json",
            data={
                "name": "hello world",
                "owner": self.user.id,
                "environment": None,
                "actionMatch": "any",
                "frequency": 5,
                "actions": [
                    {
                        "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
                        "integration": self.integration.id,
                        "dynamic_form_fields": [{"random": "garbage"}],
                        "repo": self.repo,
                        "assignee": self.assignee,
                        "labels": self.labels,
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 200

        # Get the rule from DB
        rule_object = Rule.objects.get(id=response.data["id"])
        event = self.get_group_event()

        # Trigger its `after`
        with capture_action_log() as action_log:
            self.trigger(event, rule_object)

        action_log.assert_logged(
            CreateExternalIssueAction,
            group_id=event.group_id,
            source=ActionSource.SYSTEM,
            actor=SYSTEM_ACTOR,
            provider="github",
        )

        build_external_issue_webhook.assert_called_once()
        sentry_app_call = build_external_issue_webhook.call_args
        assert sentry_app_call.kwargs["type"] == "issue.external_issue_created"
        assert sentry_app_call.kwargs["issue_id"] == event.group_id
        assert sentry_app_call.kwargs["user_id"] is None
        assert sentry_app_call.kwargs["triggered_by"] == {
            "type": "issue_alert",
            "id": str(rule_object.id),
            "name": rule_object.label,
        }

        # assert ticket created in DB
        key = self.get_key(event)
        assert key == f"{self.repo}#{self.issue_num}"
        external_issue = ExternalIssue.objects.get(key=key)
        external_issue_count = len(ExternalIssue.objects.filter(key=key))
        assert external_issue_count == 1

        activity = Activity.objects.get(
            group_id=event.group_id, type=ActivityType.CREATE_ISSUE.value
        )
        assert activity.project_id == event.project_id
        assert activity.user_id is None
        assert activity.data == {
            "title": external_issue.title,
            "provider": self.installation.model.get_provider().name,
            "location": self.installation.get_issue_url(external_issue.key),
            "label": self.installation.get_issue_display_name(external_issue) or external_issue.key,
            "new": True,
        }

        # assert ticket created in GitHub
        data = self.installation.get_issue(
            key, data={"repo": self.repo, "externalIssue": self.issue_num}
        )
        assert sample_description in data["description"]

        # Trigger its `after` _again_
        self.trigger(event, rule_object)

        # assert new ticket NOT created in DB
        build_external_issue_webhook.assert_called_once()
        assert ExternalIssue.objects.count() == external_issue_count
        assert (
            Activity.objects.filter(
                group_id=event.group_id, type=ActivityType.CREATE_ISSUE.value
            ).count()
            == 1
        )

    @responses.activate()
    def test_fails_validation(self) -> None:
        """
        Test that the absence of dynamic_form_fields in the action fails validation
        """
        # Create a new Rule
        response = self.client.post(
            reverse(
                "sentry-api-0-project-rules",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                },
            ),
            format="json",
            data={
                "name": "hello world",
                "owner": self.user.id,
                "environment": None,
                "actionMatch": "any",
                "frequency": 5,
                "actions": [
                    {
                        "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
                        "integration": self.integration.id,
                        "repo": self.repo,
                        "assignee": self.assignee,
                        "labels": self.labels,
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 400
        assert response.data["actions"][0] == "Must configure issue link settings."
