from __future__ import absolute_import

import responses
from six.moves.urllib.parse import parse_qsl

from sentry import options
from sentry.utils import json
from sentry.integrations.slack.utils import build_group_attachment, build_incident_attachment
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase

UNSET = object()

LINK_SHARED_EVENT = """{
    "type": "link_shared",
    "channel": "Cxxxxxx",
    "user": "Uxxxxxxx",
    "message_ts": "123456789.9875",
    "team_id": "TXXXXXXX1",
    "links": [
        {
            "domain": "example.com",
            "url": "http://testserver/fizz/buzz"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/%(org1)s/issues/%(group1)s/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/%(org2)s/issues/%(group2)s/bar/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/%(org1)s/issues/%(group1)s/bar/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/organizations/%(org1)s/incidents/%(incident)s/"
        },
        {
            "domain": "another-example.com",
            "url": "https://yet.another-example.com/v/abcde"
        }
    ]
}"""


class BaseEventTest(APITestCase):
    def setUp(self):
        super(BaseEventTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.integration = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

    def post_webhook(
        self, event_data=None, type="event_callback", data=None, token=UNSET, team_id="TXXXXXXX1"
    ):
        if token is UNSET:
            token = options.get("slack.verification-token")
        payload = {
            "token": token,
            "team_id": team_id,
            "api_app_id": "AXXXXXXXX1",
            "type": type,
            "authed_users": [],
            "event_id": "Ev08MFMKH6",
            "event_time": 123456789,
        }
        if data:
            payload.update(data)
        if event_data:
            payload.setdefault("event", {}).update(event_data)
        return self.client.post("/extensions/slack/event/", payload)


class UrlVerificationEventTest(BaseEventTest):
    challenge = "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"

    def test_valid_token(self):
        resp = self.client.post(
            "/extensions/slack/event/",
            {
                "type": "url_verification",
                "challenge": self.challenge,
                "token": options.get("slack.verification-token"),
            },
        )
        assert resp.status_code == 200, resp.content
        assert resp.data["challenge"] == self.challenge

    def test_invalid_token(self):
        resp = self.client.post(
            "/extensions/slack/event/",
            {"type": "url_verification", "challenge": self.challenge, "token": "fizzbuzz"},
        )
        assert resp.status_code == 401, resp.content


class LinkSharedEventTest(BaseEventTest):
    @responses.activate
    def test_valid_token(self):
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})
        org2 = self.create_organization(name="biz")
        project1 = self.create_project(organization=self.org)
        project2 = self.create_project(organization=org2)
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project2)
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            status=2, organization=self.org, projects=[project1], alert_rule=alert_rule
        )
        incident.update(identifier=123)
        resp = self.post_webhook(
            event_data=json.loads(
                LINK_SHARED_EVENT
                % {
                    "group1": group1.id,
                    "group2": group2.id,
                    "incident": incident.identifier,
                    "org1": self.org.slug,
                    "org2": org2.slug,
                }
            )
        )
        assert resp.status_code == 200, resp.content
        data = dict(parse_qsl(responses.calls[0].request.body))
        unfurls = json.loads(data["unfurls"])
        issue_url = "http://testserver/organizations/%s/issues/%s/bar/" % (self.org.slug, group1.id)
        incident_url = "http://testserver/organizations/%s/incidents/%s/" % (
            self.org.slug,
            incident.identifier,
        )
        assert unfurls == {
            issue_url: build_group_attachment(group1),
            incident_url: build_incident_attachment(incident),
        }
        assert data["token"] == "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

    @responses.activate
    def test_user_access_token(self):
        # this test is needed to make sure that classic bots installed by on-prem users
        # still work since they needed to use a user_access_token for unfurl
        self.integration.metadata.update(
            {
                "user_access_token": "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "access_token": "xoxm-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            }
        )
        self.integration.save()
        responses.add(responses.POST, "https://slack.com/api/chat.unfurl", json={"ok": True})
        org2 = self.create_organization(name="biz")
        project1 = self.create_project(organization=self.org)
        project2 = self.create_project(organization=org2)
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project2)
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            status=2, organization=self.org, projects=[project1], alert_rule=alert_rule
        )
        incident.update(identifier=123)
        resp = self.post_webhook(
            event_data=json.loads(
                LINK_SHARED_EVENT
                % {
                    "group1": group1.id,
                    "group2": group2.id,
                    "incident": incident.identifier,
                    "org1": self.org.slug,
                    "org2": org2.slug,
                }
            )
        )
        assert resp.status_code == 200, resp.content
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data["token"] == "xoxt-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
