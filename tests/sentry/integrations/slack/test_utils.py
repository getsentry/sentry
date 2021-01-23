import six

import responses
from django.core.urlresolvers import reverse
import pytest

from sentry.integrations.slack.utils import (
    build_group_attachment,
    build_incident_attachment,
    CHANNEL_PREFIX,
    get_channel_id,
    MEMBER_PREFIX,
    RESOLVED_COLOR,
    parse_link,
)
from sentry.models import Integration
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri
from sentry.shared_integrations.exceptions import (
    DuplicateDisplayNameError,
    DeprecatedIntegrationError,
)


class GetChannelIdWorkspaceTest(TestCase):
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX2",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.integration.add_organization(self.event.project.organization, self.user)
        self.add_list_response(
            "channels",
            [{"name": "my-channel", "id": "m-c"}, {"name": "other-chann", "id": "o-c"}],
            result_name="channels",
        )
        self.add_list_response(
            "groups", [{"name": "my-private-channel", "id": "m-p-c"}], result_name="groups"
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

    @with_feature("organizations:slack-allow-workspace")
    def test_valid_channel_selected(self):
        self.run_valid_test("#My-Channel", CHANNEL_PREFIX, "m-c", False)

    @with_feature("organizations:slack-allow-workspace")
    def test_valid_private_channel_selected(self):
        self.run_valid_test("#my-private-channel", CHANNEL_PREFIX, "m-p-c", False)

    @with_feature("organizations:slack-allow-workspace")
    def test_valid_member_selected(self):
        self.run_valid_test("@first-morty", MEMBER_PREFIX, "m", False)

    @with_feature("organizations:slack-allow-workspace")
    def test_valid_member_selected_display_name(self):
        self.run_valid_test("@Jimbob", MEMBER_PREFIX, "o-u", False)

    @with_feature("organizations:slack-allow-workspace")
    def test_invalid_member_selected_display_name(self):
        with pytest.raises(DuplicateDisplayNameError):
            get_channel_id(self.organization, self.integration, "@Morty")

    @with_feature("organizations:slack-allow-workspace")
    def test_invalid_channel_selected(self):
        assert get_channel_id(self.organization, self.integration, "#fake-channel")[1] is None
        assert get_channel_id(self.organization, self.integration, "@fake-user")[1] is None

    def test_invalid_deprecated_workspace_app(self):
        with pytest.raises(DeprecatedIntegrationError):
            get_channel_id(self.organization, self.integration, "#hello")


class GetChannelIdBotTest(TestCase):
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


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = "{}: {}".format("Resolved", alert_rule.name)
        assert build_incident_attachment(incident) == {
            "fallback": title,
            "title": title,
            "title_link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "text": "0 events in the last 10 minutes\nFilter: level:error",
            "fields": [],
            "mrkdwn_in": ["text"],
            "footer_icon": logo_url,
            "footer": "Sentry Incident",
            "ts": to_timestamp(incident.date_started),
            "color": RESOLVED_COLOR,
            "actions": [],
        }

    def test_metric_value(self):
        logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = "{}: {}".format("Resolved", alert_rule.name)
        metric_value = 5000
        assert build_incident_attachment(incident, metric_value=metric_value) == {
            "fallback": title,
            "title": title,
            "title_link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "text": "{} events in the last 10 minutes\nFilter: level:error".format(metric_value),
            "fields": [],
            "mrkdwn_in": ["text"],
            "footer_icon": logo_url,
            "footer": "Sentry Incident",
            "ts": to_timestamp(incident.date_started),
            "color": RESOLVED_COLOR,
            "actions": [],
        }

    def test_build_group_attachment(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal-Elephant-Giraffe-Tree-House"
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        group = self.create_group(project=self.project)
        ts = group.last_seen
        assert build_group_attachment(group) == {
            "color": "#E03E2F",
            "text": "",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + six.text_type(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + six.text_type(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": group.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": "http://testserver/organizations/rowdy-tiger/issues/"
            + six.text_type(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + six.text_type(group.id) + "}",
            "fallback": "[{}] {}".format(self.project.slug, group.title),
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }
        event = self.store_event(data={}, project_id=self.project.id)
        ts = event.datetime
        assert build_group_attachment(group, event) == {
            "color": "#E03E2F",
            "text": "",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + six.text_type(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + six.text_type(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": event.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": "http://testserver/organizations/rowdy-tiger/issues/"
            + six.text_type(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + six.text_type(group.id) + "}",
            "fallback": "[{}] {}".format(self.project.slug, event.title),
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }

        assert build_group_attachment(group, event, link_to_event=True) == {
            "color": "#E03E2F",
            "text": "",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + six.text_type(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + six.text_type(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": event.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": "http://testserver/organizations/rowdy-tiger/issues/{}/events/{}/".format(
                group.id, event.event_id
            )
            + "?referrer=slack",
            "callback_id": '{"issue":' + six.text_type(group.id) + "}",
            "fallback": "[{}] {}".format(self.project.slug, event.title),
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }

    def test_build_group_attachment_color_no_event_error_fallback(self):
        group_with_no_events = self.create_group(project=self.project)
        assert build_group_attachment(group_with_no_events)["color"] == "#E03E2F"

    def test_build_group_attachment_color_unxpected_level_error_fallback(self):
        unexpected_level_event = self.store_event(
            data={"level": "trace"}, project_id=self.project.id, assert_no_errors=False
        )
        assert build_group_attachment(unexpected_level_event.group)["color"] == "#E03E2F"

    def test_build_group_attachment_color_warning(self):
        warning_event = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert build_group_attachment(warning_event.group)["color"] == "#FFC227"
        assert build_group_attachment(warning_event.group, warning_event)["color"] == "#FFC227"

    def test_parse_link(self):
        link = "https://meowlificent.ngrok.io/organizations/sentry/issues/167/?project=2&amp;query=is%3Aunresolved"
        link2 = "https://meowlificent.ngrok.io/organizations/sentry/issues/1/events/2d113519854c4f7a85bae8b69c7404ad/?project=2"
        link3 = "https://meowlificent.ngrok.io/organizations/sentry/issues/9998089891/events/198e93sfa99d41b993ac8ae5dc384642/events/"
        assert (
            parse_link(link)
            == "organizations/{organization}/issues/{issue_id}/project=%7Bproject%7D&query=%5B%27is%3Aunresolved%27%5D"
        )
        assert (
            parse_link(link2)
            == "organizations/{organization}/issues/{issue_id}/events/{event_id}/project=%7Bproject%7D"
        )
        assert (
            parse_link(link3)
            == "organizations/{organization}/issues/{issue_id}/events/{event_id}/events/"
        )
