from uuid import uuid4

from sentry.testutils.cases import TestCase


class RuleSaveTest(TestCase):
    def test_save_cleans_condition_and_action_names(self) -> None:
        condition = {
            "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
        }
        action = {
            "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
            "service": "webhooks",
        }
        rule = self.create_project_rule(
            project=self.project,
            condition_data=[{**condition, "name": "A new issue is created"}],
            action_data=[{**action, "name": "Send a notification via webhooks"}],
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        rule.refresh_from_db()
        assert rule.data["conditions"] == [condition]
        assert rule.data["actions"] == [action]

        rule.data["conditions"] = [{**condition, "name": "Updated condition"}]
        rule.data["actions"] = [{**action, "name": "Updated action"}]
        expected_data = {**rule.data, "conditions": [condition], "actions": [action]}
        rule.save()
        rule.refresh_from_db()
        assert rule.data == expected_data


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
