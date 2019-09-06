from __future__ import absolute_import
import six

from django.core.urlresolvers import reverse

from sentry.integrations.slack.utils import (
    build_incident_attachment,
    build_group_attachment,
    LEVEL_TO_COLOR,
)
from sentry.testutils import TestCase
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))

        incident = self.create_incident()
        title = "INCIDENT: {} (#{})".format(incident.title, incident.identifier)
        assert build_incident_attachment(incident) == {
            "fallback": title,
            "title": title,
            "title_link": absolute_uri(
                reverse(
                    "sentry-incident",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "text": " ",
            "fields": [
                {"title": "Status", "value": "Open", "short": True},
                {"title": "Events", "value": 0, "short": True},
                {"title": "Users", "value": 0, "short": True},
            ],
            "mrkdwn_in": ["text"],
            "footer_icon": logo_url,
            "footer": "Sentry Incident",
            "ts": to_timestamp(incident.date_started),
            "color": LEVEL_TO_COLOR["error"],
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
                                    "text": u"#mariachi-band",
                                    "value": u"team:" + six.text_type(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": u"foo@example.com",
                                    "value": u"user:" + six.text_type(self.user.id),
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
            "footer": u"BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": u"http://testserver/organizations/rowdy-tiger/issues/"
            + six.text_type(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + six.text_type(group.id) + "}",
            "fallback": u"[{}] {}".format(self.project.slug, group.title),
            "footer_icon": u"http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }
        event = self.create_event()
        ts = event.datetime
        assert build_group_attachment(group, event) == {
            "color": "error",
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
                                    "text": u"#mariachi-band",
                                    "value": u"team:" + six.text_type(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": u"foo@example.com",
                                    "value": u"user:" + six.text_type(self.user.id),
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
            "footer": u"BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": u"http://testserver/organizations/rowdy-tiger/issues/"
            + six.text_type(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + six.text_type(group.id) + "}",
            "fallback": u"[{}] {}".format(self.project.slug, event.title),
            "footer_icon": u"http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }
