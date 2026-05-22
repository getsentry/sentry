import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip
class TestSanitizeRuleDynamicFormFieldChoices(TestMigrations):
    migrate_from = "1100_add_relocation_file_bucket_path"
    migrate_to = "1101_sanitize_rule_dynamic_form_field_choices"
    app = "sentry"

    def setup_initial_state(self) -> None:
        project = self.create_project(organization=self.create_organization())

        Rule = self.apps_before.get_model("sentry", "Rule")

        # Corrupt Jira ticket action with a serialized React element label
        # and a clean tuple alongside it.
        self.corrupted_rule = Rule.objects.create(
            project_id=project.id,
            label="corrupted-jira-rule",
            data={
                "actions": [
                    {
                        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
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
                                                        "props": {
                                                            "size": "xs",
                                                            "title": "tooltip",
                                                        },
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

        # No-recovery shape: the carcass has no string children. We expect
        # the helper to fall back to the value.
        self.unrecoverable_rule = Rule.objects.create(
            project_id=project.id,
            label="unrecoverable-jira-rule",
            data={
                "actions": [
                    {
                        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                        "dynamic_form_fields": [
                            {
                                "name": "reporter",
                                "choices": [
                                    [
                                        "user-789",
                                        {
                                            "key": None,
                                            "ref": None,
                                            "props": {"children": []},
                                        },
                                    ],
                                ],
                            }
                        ],
                    }
                ],
            },
        )

        # Clean ticket action — should be untouched.
        self.clean_rule = Rule.objects.create(
            project_id=project.id,
            label="clean-jira-rule",
            data={
                "actions": [
                    {
                        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
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

        # Non-ticket action with a coincidentally-shaped dict label. We
        # only touch known ticket-action ids, so this must stay untouched.
        self.non_ticket_rule = Rule.objects.create(
            project_id=project.id,
            label="email-rule-with-suspicious-shape",
            data={
                "actions": [
                    {
                        "id": "sentry.mail.actions.NotifyEmailAction",
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

        self.no_actions_rule = Rule.objects.create(
            project_id=project.id,
            label="rule-with-no-actions",
            data={"conditions": []},
        )

    def test_migration(self) -> None:
        from sentry.models.rule import Rule

        corrupted = Rule.objects.get(id=self.corrupted_rule.id)
        choices = corrupted.data["actions"][0]["dynamic_form_fields"][0]["choices"]
        assert choices[0] == ["user-123", "Jane Doe"]
        assert choices[1] == ["user-456", "Already Clean"]

        unrecoverable = Rule.objects.get(id=self.unrecoverable_rule.id)
        choices = unrecoverable.data["actions"][0]["dynamic_form_fields"][0]["choices"]
        assert choices[0] == ["user-789", "user-789"]

        clean = Rule.objects.get(id=self.clean_rule.id)
        choices = clean.data["actions"][0]["dynamic_form_fields"][0]["choices"]
        assert choices == [["user-1", "Alice"], ["user-2", "Bob"]]

        non_ticket = Rule.objects.get(id=self.non_ticket_rule.id)
        choices = non_ticket.data["actions"][0]["dynamic_form_fields"][0]["choices"]
        assert isinstance(choices[0][1], dict)

        no_actions = Rule.objects.get(id=self.no_actions_rule.id)
        assert "actions" not in no_actions.data
