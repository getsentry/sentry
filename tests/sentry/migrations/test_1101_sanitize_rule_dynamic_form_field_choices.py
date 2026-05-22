import pytest

from sentry.models.rule import Rule
from sentry.testutils.cases import TestMigrations

JIRA_ACTION_ID = "sentry.integrations.jira.notify_action.JiraCreateTicketAction"
EMAIL_ACTION_ID = "sentry.mail.actions.NotifyEmailAction"


@pytest.mark.skip
class TestSanitizeRuleDynamicFormFieldChoices(TestMigrations):
    migrate_from = "1100_add_relocation_file_bucket_path"
    migrate_to = "1101_sanitize_rule_dynamic_form_field_choices"
    app = "sentry"

    def setup_initial_state(self) -> None:
        project = self.create_project(organization=self.create_organization())

        # Recoverable: the carcass has string children we can extract ("Jane Doe").
        # The second choice is a clean tuple — proves we don't touch healthy rows.
        self.corrupted_rule = Rule.objects.create(
            project_id=project.id,
            label="corrupted-jira-rule",
            data={
                "actions": [
                    {
                        "id": JIRA_ACTION_ID,
                        "dynamic_form_fields": [
                            {
                                "name": "reporter",
                                "choices": [
                                    [
                                        "user-123",
                                        {
                                            "key": None,
                                            "ref": None,
                                            "props": {
                                                "children": [
                                                    {
                                                        "key": None,
                                                        "ref": None,
                                                        "props": {"size": "xs", "title": "tooltip"},
                                                    },
                                                    " ",
                                                    "Jane Doe",
                                                ],
                                            },
                                        },
                                    ],
                                    ["user-456", "Already Clean"],
                                ],
                            }
                        ],
                    }
                ],
            },
        )

        # Carcass with no string children — recovery fails, helper falls back to value.
        self.unrecoverable_rule = Rule.objects.create(
            project_id=project.id,
            label="unrecoverable-jira-rule",
            data={
                "actions": [
                    {
                        "id": JIRA_ACTION_ID,
                        "dynamic_form_fields": [
                            {
                                "name": "reporter",
                                "choices": [
                                    [
                                        "user-789",
                                        {"key": None, "ref": None, "props": {"children": []}},
                                    ],
                                ],
                            }
                        ],
                    }
                ],
            },
        )

        # Already-clean ticket action — must be untouched.
        self.clean_rule = Rule.objects.create(
            project_id=project.id,
            label="clean-jira-rule",
            data={
                "actions": [
                    {
                        "id": JIRA_ACTION_ID,
                        "dynamic_form_fields": [
                            {
                                "name": "assignee",
                                "choices": [["user-1", "Alice"], ["user-2", "Bob"]],
                            }
                        ],
                    }
                ],
            },
        )

        # Non-ticket action whose label coincidentally looks like a carcass.
        # Proves the action-id scoping prevents collateral damage.
        self.non_ticket_rule = Rule.objects.create(
            project_id=project.id,
            label="email-rule-with-suspicious-shape",
            data={
                "actions": [
                    {
                        "id": EMAIL_ACTION_ID,
                        "dynamic_form_fields": [
                            {
                                "name": "whatever",
                                "choices": [
                                    [
                                        "x",
                                        {
                                            "key": None,
                                            "ref": None,
                                            "props": {"children": ["leave me alone"]},
                                        },
                                    ],
                                ],
                            }
                        ],
                    }
                ],
            },
        )

        # Rule whose data has no actions key at all — migration must not crash.
        self.no_actions_rule = Rule.objects.create(
            project_id=project.id,
            label="rule-with-no-actions",
            data={"conditions": []},
        )

    def _get_choices(self, rule_id: int) -> list:
        rule = Rule.objects.get(id=rule_id)
        return rule.data["actions"][0]["dynamic_form_fields"][0]["choices"]

    def test_recovers_text_from_react_element_carcass(self) -> None:
        assert self._get_choices(self.corrupted_rule.id)[0] == ["user-123", "Jane Doe"]

    def test_preserves_clean_tuple_within_corrupted_rule(self) -> None:
        assert self._get_choices(self.corrupted_rule.id)[1] == ["user-456", "Already Clean"]

    def test_falls_back_to_value_when_unrecoverable(self) -> None:
        assert self._get_choices(self.unrecoverable_rule.id)[0] == ["user-789", "user-789"]

    def test_does_not_touch_clean_rule(self) -> None:
        assert self._get_choices(self.clean_rule.id) == [["user-1", "Alice"], ["user-2", "Bob"]]

    def test_does_not_touch_non_ticket_actions(self) -> None:
        # The label is still the original dict — action-id filter held.
        assert isinstance(self._get_choices(self.non_ticket_rule.id)[0][1], dict)

    def test_skips_rules_without_actions(self) -> None:
        rule = Rule.objects.get(id=self.no_actions_rule.id)
        assert "actions" not in rule.data
