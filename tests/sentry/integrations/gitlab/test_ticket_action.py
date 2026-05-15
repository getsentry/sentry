from time import time

import orjson
import responses
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.integrations.gitlab.actions.create_ticket import GitlabCreateTicketAction
from sentry.integrations.gitlab.integration import GitlabIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.models.rule import Rule
from sentry.services.eventstore.models import GroupEvent
from sentry.silo.base import SiloMode
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.rules import RuleFuture
from sentry.users.models.identity import Identity, IdentityProvider

pytestmark = [requires_snuba]


class GitlabTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = GitlabCreateTicketAction
    project_id = "10"
    project_name = "getsentry/sentry"
    issue_iid = "1"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="gitlab",
                name="Example Gitlab",
                external_id="example.gitlab.com:group-x",
                metadata={
                    "instance": "example.gitlab.com",
                    "base_url": "https://example.gitlab.com",
                    "domain_name": "example.gitlab.com/group-x",
                    "verify_ssl": False,
                    "webhook_secret": "secret-token-value",
                    "group_id": 1,
                },
            )
            identity = Identity.objects.create(
                idp=IdentityProvider.objects.create(type="gitlab", config={}),
                user=self.user,
                external_id="gitlab123",
                data={
                    "access_token": "123456789",
                    "created_at": time(),
                    "refresh_token": "0987654321",
                },
            )
            self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = get_installation_of_type(
            GitlabIntegration, self.integration, self.organization.id
        )

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

    @responses.activate
    def test_ticket_rules(self) -> None:
        responses.add(
            responses.POST,
            f"https://example.gitlab.com/api/v4/projects/{self.project_id}/issues",
            json={
                "id": 8,
                "iid": self.issue_iid,
                "title": "sample title",
                "description": "sample bug report",
                "web_url": f"https://example.gitlab.com/{self.project_name}/issues/{self.issue_iid}",
            },
            status=201,
        )
        responses.add(
            responses.GET,
            f"https://example.gitlab.com/api/v4/projects/{self.project_id}",
            json={"path_with_namespace": self.project_name, "id": int(self.project_id)},
        )

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
                        "id": "sentry.integrations.gitlab.notify_action.GitlabCreateTicketAction",
                        "integration": self.integration.id,
                        "dynamic_form_fields": [{"name": "project"}],
                        "project": self.project_id,
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 200

        rule_object = Rule.objects.get(id=response.data["id"])
        event = self.get_group_event()

        self.trigger(event, rule_object)

        key = self.get_key(event)
        assert key == f"example.gitlab.com/group-x:{self.project_name}#{self.issue_iid}"
        external_issue_count = len(ExternalIssue.objects.filter(key=key))
        assert external_issue_count == 1

        request_data = orjson.loads(responses.calls[0].request.body)
        assert request_data["title"] == event.title
        assert "This issue was automatically created by Sentry" in request_data["description"]

        self.trigger(event, rule_object)

        assert ExternalIssue.objects.count() == external_issue_count

    @responses.activate
    def test_fails_validation(self) -> None:
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
                        "id": "sentry.integrations.gitlab.notify_action.GitlabCreateTicketAction",
                        "integration": self.integration.id,
                        "project": self.project_id,
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 400
        assert response.data["actions"][0] == "Must configure issue link settings."
