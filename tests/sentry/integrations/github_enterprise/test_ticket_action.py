from unittest.mock import patch

import pytest
import responses
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.eventstore.models import Event
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.github_enterprise import GitHubEnterpriseCreateTicketAction, client
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.rule import Rule
from sentry.rules import rules
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.rules import RuleFuture

pytestmark = [requires_snuba]

# Adding GitHub Enterprise ticket action is protected by an option, and we
# cannot override the option before importing it in the test so we need to
# manually add it here.
if GitHubEnterpriseCreateTicketAction.id not in rules:
    rules.add(GitHubEnterpriseCreateTicketAction)


class GitHubEnterpriseEnterpriseTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = GitHubEnterpriseCreateTicketAction
    repo = "foo/bar"
    assignee = "sentry_user"
    labels = ["bug", "invalid"]
    issue_num = 1

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="Github Enterprise",
            external_id="1",
            metadata={
                "domain_name": "github.example.com",
                "installation": {
                    "private_key": "fake key",
                    "id": 1,
                    "verify_ssl": True,
                },
                "installation_id": 1234,
            },
        )

        self.installation: GitHubIntegration = self.integration.get_installation(self.organization.id)  # type: ignore[assignment]

        self.login_as(user=self.user)
        responses.add(
            method=responses.POST,
            url="https://github.example.com/api/v3/app/installations/1234/access_tokens",
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
        results = list(action_inst.after(event=event, state=self.get_state()))
        assert len(results) == 1

        rule_future = RuleFuture(rule=rule_object, kwargs=results[0].kwargs)
        return results[0].callback(event, futures=[rule_future])

    def get_key(self, event: Event):
        return ExternalIssue.objects.get_linked_issues(event, self.integration).values_list(
            "key", flat=True
        )[0]

    @responses.activate()
    def test_ticket_rules(self):
        title = "sample title"
        sample_description = "sample bug report"
        html_url = f"https://github.example.com/api/v3/foo/bar/issues/{self.issue_num}"

        responses.add(
            method=responses.POST,
            url="https://github.example.com/api/v3/repos/foo/bar/issues",
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
            url=f"https://github.example.com/api/v3/repos/foo/bar/issues/{self.issue_num}",
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
                    "organization_slug": self.organization.slug,
                    "project_slug": self.project.slug,
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
                        "id": "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
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
        event = self.get_event()

        # Trigger its `after`
        self.trigger(event, rule_object)

        # assert ticket created in DB
        key = self.get_key(event)
        external_issue_count = len(ExternalIssue.objects.filter(key=key))
        assert external_issue_count == 1

        # assert ticket created in GitHub Enterprise
        data = self.installation.get_issue(
            key, data={"repo": self.repo, "externalIssue": self.issue_num}
        )
        assert sample_description in data["description"]

        # Trigger its `after` _again_
        self.trigger(event, rule_object)

        # assert new ticket NOT created in DB
        assert ExternalIssue.objects.count() == external_issue_count

    @responses.activate()
    def test_fails_validation(self):
        """
        Test that the absence of dynamic_form_fields in the action fails validation
        """
        # Create a new Rule
        response = self.client.post(
            reverse(
                "sentry-api-0-project-rules",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "project_slug": self.project.slug,
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
                        "id": "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
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
