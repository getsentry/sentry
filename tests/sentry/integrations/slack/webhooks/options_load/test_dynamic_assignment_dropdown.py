from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

from . import BaseEventTest

pytestmark = [requires_snuba]


class DynamicAssignmentDropdownTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        self.event_data = {
            "event_id": "a" * 32,
            "message": "IntegrationError",
            "fingerprint": ["group-1"],
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": "Identity not found.",
                    }
                ]
            },
        }
        self.original_message: dict = {
            "type": "message",
            "text": "[internal] IntegrationError",
            "blocks": [
                {
                    "block_id": "",
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "IntegrationError", "verbatim": False},
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "action_id": "resolve_dialog",
                            "text": {"type": "plain_text", "text": "Resolve", "emoji": True},
                            "value": "resolve_dialog",
                        },
                        {
                            "type": "button",
                            "action_id": "ignored:forever",
                            "text": {"type": "plain_text", "text": "Ignore", "emoji": True},
                            "value": "ignored:forever",
                        },
                        {
                            "type": "external_select",
                            "action_id": "assign",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select Assignee...",
                                "emoji": True,
                            },
                        },
                    ],
                },
            ],
        }

    @freeze_time("2021-01-14T12:27:28.303Z")
    @with_feature("organizations:slack-block-kit")
    def test_simple(self):
        self.team1 = self.create_team(name="aaaa", slug="aaaa")
        self.team2 = self.create_team(name="aaab", slug="eeee")
        self.team3 = self.create_team(name="xyz", slug="aaac")
        self.team4 = self.create_team(
            name="zzaaazz", slug="zzaaazz"
        )  # name nor slug doesn't start with substring
        self.team5 = self.create_team(name="aaad", slug="aaad")  # not in project

        self.project = self.create_project(teams=[self.team1, self.team2, self.team3, self.team4])
        self.group = self.create_group(project=self.project)
        self.original_message["blocks"][0]["block_id"] = json.dumps({"issue": self.group.id})

        self.user1 = self.create_user(email="aaa@testing.com", name="Alice")
        self.create_member(organization=self.organization, user=self.user1, teams=[self.team4])
        self.user2 = self.create_user(email="blah@testing.com", name="AaA")
        self.create_member(organization=self.organization, user=self.user2, teams=[self.team4])
        self.user3 = self.create_user(email="bbb@testing.com", name="aaa")
        self.create_member(organization=self.organization, user=self.user3, teams=[self.team4])
        self.user4 = self.create_user(
            email="baaa@testing.com", name="Baaa"
        )  # name nor email doesn't start with substring
        self.create_member(organization=self.organization, user=self.user4, teams=[self.team4])
        self.user5 = self.create_user(email="aaaa@testing.com", name="aaa")
        self.create_member(
            organization=self.organization, user=self.user5, teams=[self.team5]
        )  # not in project

        self.store_event(data=self.event_data, project_id=self.project.id)

        resp = self.post_webhook(substring="aaa", original_message=self.original_message)

        assert resp.status_code == 200
        assert len(resp.data["option_groups"][0]["options"]) == 3
        assert len(resp.data["option_groups"][1]["options"]) == 3

    def test_no_flag(self):
        self.group = self.create_group(project=self.project)
        self.original_message["blocks"][0]["block_id"] = json.dumps({"issue": self.group.id})
        resp = self.post_webhook(substring="bbb", original_message=self.original_message)

        assert resp.status_code == 400

    @with_feature("organizations:slack-block-kit")
    def test_non_existent_group(self):
        self.original_message["blocks"][0]["block_id"] = json.dumps({"issue": 1})
        resp = self.post_webhook(substring="bbb", original_message=self.original_message)

        assert resp.status_code == 400
