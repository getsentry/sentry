import pytest

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action

TICKET_CONFIG = {
    "target_type": ActionTarget.SPECIFIC.value,
    "target_identifier": None,
    "target_display": None,
}


@pytest.mark.skip
class TestSanitizeDynamicFormFieldChoices(TestMigrations):
    migrate_from = "0113_migrate_data_conditions_categories"
    migrate_to = "0114_sanitize_dynamic_form_field_choices"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.corrupted_action = Action.objects.create(
            type="jira",
            config=TICKET_CONFIG,
            data={
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
                                                    "title": {
                                                        "key": None,
                                                        "ref": None,
                                                        "props": {
                                                            "children": {
                                                                "key": "5",
                                                                "ref": None,
                                                                "props": {
                                                                    "children": [
                                                                        {
                                                                            "key": "0",
                                                                            "ref": None,
                                                                            "props": {
                                                                                "children": "This is your current "
                                                                            },
                                                                            "_owner": None,
                                                                        },
                                                                        {
                                                                            "key": "2",
                                                                            "ref": None,
                                                                            "props": {
                                                                                "children": "Reporter"
                                                                            },
                                                                            "_owner": None,
                                                                        },
                                                                        {
                                                                            "key": "3",
                                                                            "ref": None,
                                                                            "props": {
                                                                                "children": "."
                                                                            },
                                                                            "_owner": None,
                                                                        },
                                                                    ]
                                                                },
                                                                "_owner": None,
                                                            }
                                                        },
                                                        "_owner": None,
                                                    },
                                                },
                                                "_owner": None,
                                            },
                                            " ",
                                            "Jane Doe",
                                        ]
                                    },
                                    "_owner": None,
                                },
                            ],
                            ["user-456", "Already Clean"],
                        ],
                    }
                ],
                "additional_fields": {},
            },
        )

        self.clean_action = Action.objects.create(
            type="jira",
            config=TICKET_CONFIG,
            data={
                "dynamic_form_fields": [
                    {
                        "name": "assignee",
                        "choices": [["user-1", "Alice"], ["user-2", "Bob"]],
                    }
                ],
                "additional_fields": {},
            },
        )

        self.no_fields_action = Action.objects.create(
            type="jira",
            config=TICKET_CONFIG,
            data={"additional_fields": {}},
        )

    def test_migration(self) -> None:
        corrupted = Action.objects.get(id=self.corrupted_action.id)
        choices = corrupted.data["dynamic_form_fields"][0]["choices"]
        assert choices[0] == ["user-123", "Jane Doe"]
        assert choices[1] == ["user-456", "Already Clean"]

        clean = Action.objects.get(id=self.clean_action.id)
        choices = clean.data["dynamic_form_fields"][0]["choices"]
        assert choices == [["user-1", "Alice"], ["user-2", "Bob"]]

        no_fields = Action.objects.get(id=self.no_fields_action.id)
        assert "dynamic_form_fields" not in no_fields.data
