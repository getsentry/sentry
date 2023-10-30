import re
import time
from unittest import mock

import responses

from sentry.integrations.msteams import MsTeamsNotifyServiceAction
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


class MsTeamsNotifyActionTest(RuleTestCase, PerformanceIssueTestCase):
    rule_cls = MsTeamsNotifyServiceAction

    def setUp(self):
        event = self.get_event()

        self.integration = Integration.objects.create(
            provider="msteams",
            name="Galactic Empire",
            external_id="D4r7h_Pl4gu315_th3_w153",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "d4rk51d3",
                "expires_at": int(time.time()) + 86400,
            },
        )
        self.integration.add_organization(event.project.organization, self.user)

    def assert_form_valid(self, form, expected_channel_id, expected_channel):
        assert form.is_valid()
        assert form.cleaned_data["channel_id"] == expected_channel_id
        assert form.cleaned_data["channel"] == expected_channel

    @responses.activate
    @mock.patch("sentry.analytics.record")
    def test_applies_correctly(self, mock_record):
        event = self.get_event()

        rule = self.get_rule(
            data={"team": self.integration.id, "channel": "Naboo", "channel_id": "nb"}
        )

        notification_uuid = "123e4567-e89b-12d3-a456-426614174000"
        results = list(
            rule.after(event=event, state=self.get_state(), notification_uuid=notification_uuid)
        )
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/nb/activities",
            status=200,
            json={},
        )

        results[0].callback(event, futures=[])
        data = json.loads(responses.calls[0].request.body)

        assert "attachments" in data
        attachments = data["attachments"]
        assert len(attachments) == 1

        # Wish there was a better way to do this, but we
        # can't pass the title and title link separately
        # with MS Teams cards.
        title_card = attachments[0]["content"]["body"][0]
        title_pattern = r"\[%s\](.*)" % event.title
        assert re.match(title_pattern, title_card["text"])
        mock_record.assert_called_with(
            "alert.sent",
            provider="msteams",
            alert_id="",
            alert_type="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            external_id="nb",
            notification_uuid=notification_uuid,
        )
        mock_record.assert_any_call(
            "integrations.msteams.notification_sent",
            category="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=event.group_id,
            notification_uuid=notification_uuid,
            alert_id=None,
        )

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_applies_correctly_generic_issue(self, occurrence):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        rule = self.get_rule(
            data={"team": self.integration.id, "channel": "Hellboy", "channel_id": "nb"}
        )
        results = list(rule.after(event=group_event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/nb/activities",
            status=200,
            json={},
        )

        results[0].callback(event, futures=[])

        data = json.loads(responses.calls[0].request.body)
        assert "attachments" in data
        attachments = data["attachments"]
        assert len(attachments) == 1

        title_card = attachments[0]["content"]["body"][0]
        description = attachments[0]["content"]["body"][1]

        assert (
            title_card["text"]
            == f"[{TEST_ISSUE_OCCURRENCE.issue_title}](http://testserver/organizations/{self.organization.slug}/issues/{event.group_id}/?referrer=msteams)"
        )
        assert description["text"] == TEST_ISSUE_OCCURRENCE.evidence_display[0].value

    @responses.activate
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_applies_correctly_performance_issue(self, occurrence):
        event = self.create_performance_issue()

        rule = self.get_rule(
            data={"team": self.integration.id, "channel": "Naboo", "channel_id": "nb"}
        )
        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/nb/activities",
            status=200,
            json={},
        )

        results[0].callback(event, futures=[])

        data = json.loads(responses.calls[0].request.body)
        assert "attachments" in data
        attachments = data["attachments"]
        assert len(attachments) == 1

        title_card = attachments[0]["content"]["body"][0]
        description = attachments[0]["content"]["body"][1]
        assert (
            title_card["text"]
            == f"[N+1 Query](http://testserver/organizations/{self.organization.slug}/issues/{event.group_id}/?referrer=msteams)"
        )
        assert (
            description["text"]
            == "db - SELECT `books\\_author`.`id`, `books\\_author`.`name` FROM `books\\_author` WHERE `books\\_author`.`id` = %s LIMIT 21"
        )

    def test_render_label(self):
        rule = self.get_rule(data={"team": self.integration.id, "channel": "Tatooine"})

        assert rule.render_label() == "Send a notification to the Galactic Empire Team to Tatooine"

    def test_render_label_without_integration(self):
        self.integration.delete()

        rule = self.get_rule(data={"team": self.integration.id, "channel": "Coruscant"})

        assert rule.render_label() == "Send a notification to the [removed] Team to Coruscant"

    @responses.activate
    def test_valid_channel_selected(self):
        rule = self.get_rule(data={"team": self.integration.id, "channel": "Death Star"})

        channels = [{"id": "d_s", "name": "Death Star"}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/teams/D4r7h_Pl4gu315_th3_w153/conversations",
            json={"conversations": channels},
        )

        form = rule.get_form_instance()
        self.assert_form_valid(form, "d_s", "Death Star")

    @responses.activate
    def test_valid_member_selected(self):
        rule = self.get_rule(data={"team": self.integration.id, "channel": "Darth Vader"})

        channels = [{"id": "i_s_d", "name": "Imperial Star Destroyer"}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/teams/D4r7h_Pl4gu315_th3_w153/conversations",
            json={"conversations": channels},
        )

        members = [{"name": "Darth Vader", "id": "d_v", "tenantId": "1428-5714-2857"}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/conversations/D4r7h_Pl4gu315_th3_w153/pagedmembers?pageSize=500",
            json={"members": members},
        )

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations",
            json={"id": "i_am_your_father"},
        )

        form = rule.get_form_instance()
        self.assert_form_valid(form, "i_am_your_father", "Darth Vader")

    @responses.activate
    def test_invalid_channel_selected(self):
        rule = self.get_rule(data={"team": self.integration.id, "channel": "Alderaan"})

        channels = [{"name": "Hoth", "id": "hh"}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/teams/D4r7h_Pl4gu315_th3_w153/conversations",
            json={"conversations": channels},
        )

        members = [{"name": "Darth Sidious", "id": "d_s", "tenantId": "0102-0304-0506"}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/conversations/D4r7h_Pl4gu315_th3_w153/pagedmembers?pageSize=500",
            json={"members": members},
        )

        form = rule.get_form_instance()

        assert not form.is_valid()
        assert len(form.errors) == 1
