from uuid import uuid4

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.models.environment import Environment
from sentry.models.rule import Rule
from sentry.testutils.cases import TestCase


class TestRule_GetRuleActionDetailsByUuid(TestCase):
    def setUp(self) -> None:
        self.action_uuid = str(uuid4())
        self.action = {
            "targetType": "IssueOwners",
            "fallthroughType": "ActiveMembers",
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetIdentifier": "",
            "uuid": self.action_uuid,
        }
        self.notify_issue_owners_action = [
            self.action,
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": str(uuid4()),
            },
        ]
        self.rule = self.create_project_rule(
            project=self.project, action_data=self.notify_issue_owners_action
        )

    def test_simple(self) -> None:
        result = self.rule.get_rule_action_details_by_uuid(self.action_uuid)
        assert result == self.action

    def test_returns_none(self) -> None:
        result = self.rule.get_rule_action_details_by_uuid(str(uuid4()))
        assert result is None

    def test_when_no_actions_are_in_rule(self) -> None:
        rule = self.create_project_rule(
            project=self.project,
            action_data=[],
        )
        result = rule.get_rule_action_details_by_uuid(str(uuid4()))
        assert result is None

    def test_when_actions_have_missing_uuid_key(self) -> None:
        rule = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "targetType": "IssueOwners",
                    "fallthroughType": "ActiveMembers",
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": "",
                }
            ],
        )
        result = rule.get_rule_action_details_by_uuid(str(uuid4()))
        assert result is None

    def test_when_action_has_missing_uuid_value(self) -> None:
        rule = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "targetType": "IssueOwners",
                    "fallthroughType": "ActiveMembers",
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": "",
                    "uuid": "",
                }
            ],
        )
        result = rule.get_rule_action_details_by_uuid(str(uuid4()))
        assert result is None


class RuleShadowEnvironmentIdTest(TestCase):
    def rule_updates(self, queries: CaptureQueriesContext) -> list[str]:
        return [
            query["sql"]
            for query in queries.captured_queries
            if query["sql"].lstrip().upper().startswith("UPDATE")
            and '"sentry_rule"' in query["sql"]
        ]

    def test_save_mirrors_environment_id(self) -> None:
        environment = Environment.get_or_create(self.project, "production")

        rule = Rule.objects.create(
            project=self.project, label="Golden Rule", environment_id=environment.id
        )

        rule.refresh_from_db()
        assert rule.new_environment_id == environment.id

        rule.environment_id = None
        rule.save()

        rule.refresh_from_db()
        assert rule.new_environment_id is None

    def test_save_issues_no_follow_up_update(self) -> None:
        environment = Environment.get_or_create(self.project, "production")
        using = router.db_for_write(Rule)

        with CaptureQueriesContext(connections[using]) as creating:
            rule = Rule.objects.create(
                project=self.project, label="Golden Rule", environment_id=environment.id
            )

        assert self.rule_updates(creating) == []

        # Saving an existing row does issue one, which is what proves the check above
        # is looking at something it can actually find.
        with CaptureQueriesContext(connections[using]) as resaving:
            rule.save()

        assert self.rule_updates(resaving) != []
