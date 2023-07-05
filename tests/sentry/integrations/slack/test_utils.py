import pytest
import responses

from sentry.integrations.slack.utils import get_channel_id
from sentry.integrations.slack.utils.channel import CHANNEL_PREFIX, MEMBER_PREFIX
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiRateLimitedError, DuplicateDisplayNameError
from sentry.testutils import TestCase
from sentry.testutils.helpers import install_slack, with_feature
from sentry.utils import json

# from responses import matchers


class GetChannelIdBotTest(TestCase):
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

    def add_list_response(self, list_type, channels, result_name="channels"):
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/%s.list" % list_type,
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", result_name: channels}),
        )

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


class GetChannelIdErrorBotTest(TestCase):
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


class GetChannelIdFasterTest(TestCase):
    @with_feature("organizations:slack-use-new-lookup")
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = install_slack(self.event.project.organization)
        # self.add_list_response(
        #     "users",
        #     [
        #         {"name": "first-morty", "id": "m", "profile": {"display_name": "Morty"}},
        #         {"name": "other-user", "id": "o-u", "profile": {"display_name": "Jimbob"}},
        #         {"name": "better_morty", "id": "bm", "profile": {"display_name": "Morty"}},
        #     ],
        #     result_name="members",
        # )

    @with_feature("organizations:slack-use-new-lookup")
    def tearDown(self):
        self.resp.__exit__(None, None, None)

    def add_list_response(self, list_type, channels, result_name="channels"):
        self.resp.add(
            method=responses.GET,
            url="https://slack.com/api/%s.list" % list_type,
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", result_name: channels}),
        )

    def add_msg_response(self, channelname, channelid, result_name="channel"):
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            #     match=[matchers.json_params_matcher({"channel": channelname})],
            body=json.dumps(
                {"ok": "true", result_name: channelid, "scheduled_message_id": "Q1298393284"}
            ),
        )
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": channelid}),
        )

    @with_feature("organizations:slack-use-new-lookup")
    def run_valid_test(self, channel, expected_prefix, expected_id, timed_out):
        assert (expected_prefix, expected_id, timed_out) == get_channel_id(
            self.organization, self.integration, channel
        )

    @with_feature("organizations:slack-use-new-lookup")
    def test_valid_channel_selected_new(self):
        self.add_msg_response("my-channel", "m-c")
        # ^^ this adds the responses this code path will hit
        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

    @with_feature("organizations:slack-use-new-lookup")
    def test_valid_private_channel_selected_new(self):
        self.add_msg_response("my-private-channel", "m-p-c")
        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

    @with_feature("organizations:slack-use-new-lookup")
    def test_valid_member_selected(self):
        # add_msg_response making sure no match comes back so you fall into the user.list code path
        # mock the user.list response so you find your user
        self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    @with_feature("organizations:slack-use-new-lookup")
    def test_valid_member_selected_display_name(self):
        self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    @with_feature("organizations:slack-use-new-lookup")
    def test_invalid_member_selected_display_name(self):
        with pytest.raises(DuplicateDisplayNameError):
            get_channel_id(self.organization, self.integration, "@Morty")

    @with_feature("organizations:slack-use-new-lookup")
    def test_invalid_channel_selected_new(self):
        assert get_channel_id(self.organization, self.integration, "#fake-channel")[1] is None
        assert get_channel_id(self.organization, self.integration, "@fake-user")[1] is None


class GetChannelIdFasterErrorTest(TestCase):
    @with_feature("organizations:slack-use-new-lookup")
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

    @with_feature("organizations:slack-use-new-lookup")
    def tearDown(self):
        self.resp.__exit__(None, None, None)

    @with_feature("organizations:slack-use-new-lookup")
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
