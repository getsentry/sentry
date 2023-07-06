import pytest
import responses

from sentry.integrations.slack.utils import get_channel_id
from sentry.integrations.slack.utils.channel import CHANNEL_PREFIX, MEMBER_PREFIX
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.testutils import TestCase
from sentry.testutils.helpers import install_slack, with_feature
from sentry.utils import json


class GetChannelIdTest(TestCase):
    def add_list_response(self, list_type, channels, result_name="channels"):
        self.resp = responses.mock
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/%s.list" % list_type,
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", result_name: channels}),
        )


class GetChannelIdBotTest(GetChannelIdTest):
    def setUp(self):

        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = install_slack(self.event.project.organization)

        self.add_list_response(
            "conversations",
            [
                {"name": "my-channel", "id": "m-c"},
                {"name": "other-chann", "id": "o-c"},
                {"name": "my-private-channel", "id": "m-p-c", "is_private": True},
            ],
            result_name="channels",
        )
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )

    def tearDown(self):
        self.resp.__exit__(None, None, None)

    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert (expected_prefix, expected_id, timed_out) == get_channel_id(
            self.organization, self.integration, channel
        )

    def test_valid_channel_selected(self):
        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

    def test_valid_private_channel_selected(self):
        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

    def test_valid_member_selected(self):
        self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    def test_valid_member_selected_display_name(self):
        self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    def test_invalid_member_selected_display_name(self):
        with pytest.raises(DuplicateDisplayNameError):
            get_channel_id(self.organization, self.integration, "@Morty")

    def test_invalid_channel_selected(self):
        assert get_channel_id(self.organization, self.integration, "#fake-channel")[1] is None
        assert get_channel_id(self.organization, self.integration, "@fake-user")[1] is None


class GetChannelIdErrorBotTest(GetChannelIdTest):
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.event.project.organization, self.user)

    def tearDown(self):
        self.resp.__exit__(None, None, None)

    def test_rate_limiting(self):
        """Should handle 429 from Slack when searching for channels"""
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=429,
            content_type="application/json",
            body=json.dumps({"ok": "false", "error": "ratelimited"}),
        )
        with pytest.raises(ApiRateLimitedError):
            get_channel_id(self.organization, self.integration, "@user")


class GetChannelIdFasterTest(GetChannelIdTest):
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = install_slack(self.event.project.organization)

    def tearDown(self):
        self.resp.__exit__(None, None, None)

    def add_msg_response(self, channel_id, result_name="channel"):

        if channel_id == "channel_not_found":
            bodydict = {"ok": False, "error": "channel_not_found"}
        else:
            bodydict = {"ok": True, result_name: channel_id, "scheduled_message_id": "Q1298393284"}

        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(bodydict),
        )

    @with_feature("organizations:slack-use-new-lookup")
    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert (expected_prefix, expected_id, timed_out) == get_channel_id(
            self.organization, self.integration, channel
        )

    def test_valid_channel_selected_new(self):
        self.add_msg_response("m-c")
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )
        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

    def test_valid_private_channel_selected_new(self):
        self.add_msg_response("m-p-c")
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )
        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

    def test_valid_member_selected(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    def test_valid_member_selected_display_name(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    @with_feature("organizations:slack-use-new-lookup")
    def test_invalid_member_selected_display_name(self):
        self.add_msg_response("channel_not_found")
        self.add_list_response(
            "users",
            [
                {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
                {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
                {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
            ],
            result_name="members",
        )
        with pytest.raises(DuplicateDisplayNameError):
            get_channel_id(self.organization, self.integration, "@Morty")

    @with_feature("organizations:slack-use-new-lookup")
    def test_invalid_channel_selected(self):
        self.add_msg_response("channel_not_found")
        assert get_channel_id(self.organization, self.integration, "#fake-channel")[1] is None
        assert get_channel_id(self.organization, self.integration, "@fake-user")[1] is None

    @with_feature("organizations:slack-use-new-lookup")
    def test_rate_limiting(self):
        """Should handle 429 from Slack when searching for channels"""
        self.add_msg_response("channel_not_found")
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=429,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "ratelimited"}),
        )
        with pytest.raises(ApiRateLimitedError):
            get_channel_id(self.organization, self.integration, "@user")
