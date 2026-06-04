from uuid import uuid4

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
