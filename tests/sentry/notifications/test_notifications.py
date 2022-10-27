import logging
import uuid
from time import time
from unittest.mock import patch
from urllib.parse import parse_qs

import responses
from django.core import mail
from django.utils import timezone
from sentry_relay import parse_release

from sentry.event_manager import EventManager
from sentry.models import (
    Group,
    GroupAssignee,
    GroupStatus,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Rule,
    UserOption,
)
from sentry.tasks.post_process import post_process_group
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.utils import json


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


def get_attachment():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "text" in data
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])

    assert len(attachments) == 1
    return attachments[0], data["text"][0]


# The analytics event `name` was called with `kwargs` being a subset of its properties
def analytics_called_with_args(fn, name, **kwargs):
    for call_args, call_kwargs in fn.call_args_list:
        event_name = call_args[0]
        if event_name == name:
            assert all(call_kwargs.get(key, None) == val for key, val in kwargs.items())
            return True
    return False


class ActivityNotificationTest(APITestCase):
    """
    Enable Slack AND email notification settings for a user
    """

    def setUp(self):
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        url = "/api/0/users/me/notification-settings/"
        data = {
            "workflow": {"user": {"me": {"email": "always", "slack": "always"}}},
            "deploy": {"user": {"me": {"email": "always", "slack": "always"}}},
            "alerts": {"user": {"me": {"email": "always", "slack": "always"}}},
        }
        self.login_as(self.user)
        response = self.client.put(url, format="json", data=data)
        assert response.status_code == 204, response.content

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        self.name = self.user.get_display_name()
        self.short_id = self.group.qualified_short_id

    @responses.activate
    def test_sends_note_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when a comment is created on an issue.
        """

        # leave a comment
        url = f"/api/0/issues/{self.group.id}/comments/"
        with self.tasks():
            response = self.client.post(url, format="json", data={"text": "blah blah"})
        assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert "blah blah" in msg.body
        # check the html version
        assert "blah blah</p></div>" in msg.alternatives[0][0]

        attachment, text = get_attachment()
        # check the Slack version
        assert text == f"New comment by {self.name}"
        assert attachment["title"] == f"{self.group.title}"
        assert (
            attachment["title_link"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note_activity-slack"
        )
        assert attachment["text"] == "blah blah"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    def test_sends_unassignment_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is unassigned.
        """
        url = f"/api/0/issues/{self.group.id}/"
        GroupAssignee.objects.create(
            group=self.group, project=self.project, user=self.user, date_added=timezone.now()
        )
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": ""})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert f"Unassigned\n\n{self.user.username} unassigned {self.short_id}" in msg.body
        # check the html version
        assert f"{self.user.username}</strong> unassigned" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert text == f"Issue unassigned by {self.name}"
        assert attachment["title"] == self.group.title
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_resolution_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is resolved.
        """
        url = f"/api/0/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"status": "resolved"})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert f"{self.user.username} marked {self.short_id} as resolved" in msg.body
        # check the html version
        assert f"{self.short_id}</a> as resolved</p>" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification|{self.short_id}> as resolved"
        )
        assert attachment["title"] == self.group.title
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_activity-slack-user|Notification Settings>"
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=self.group.id,
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_deployment_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when a release is deployed.
        """

        release = self.create_release()
        version_parsed = self.version_parsed = parse_release(release.version)["description"]
        url = f"/api/0/organizations/{self.organization.slug}/releases/{release.version}/deploys/"
        with self.tasks():
            response = self.client.post(
                url, format="json", data={"environment": self.environment.name}
            )
        assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert f"Version {version_parsed} was deployed to {self.environment.name} on" in msg.body
        # check the html version
        assert (
            f"Version {version_parsed} was deployed to {self.environment.name}\n    </h2>\n"
            in msg.alternatives[0][0]
        )

        attachment, text = get_attachment()

        assert (
            text
            == f"Release {version_parsed} was deployed to {self.environment.name} for this project"
        )
        assert (
            attachment["actions"][0]["url"]
            == f"http://testserver/organizations/{self.organization.slug}/releases/{release.version}/?project={self.project.id}&unselectedSeries=Healthy/"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/deploy/?referrer=release_activity-slack-user|Notification Settings>"
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=None,
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=None,
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_regression_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue regresses.
        """
        # resolve and unresolve the issue
        ts = time() - 300
        manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
        with self.tasks():
            event = manager.save(self.project.id)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 50))
        with self.tasks():
            event2 = manager.save(self.project.id)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()

        msg = mail.outbox[0]
        # check the txt version
        assert f"Sentry marked {group.qualified_short_id} as a regression" in msg.body
        # check the html version
        assert f"{group.qualified_short_id}</a> as a regression</p>" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert text == "Issue marked as regression"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user|Notification Settings>"
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=group.id,
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=group.id,
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_resolved_in_release_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is resolved by a release.
        """
        release = self.create_release()
        url = f"/api/0/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"status": "resolved", "statusDetails": {"inRelease": release.version}},
            )
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert (
            f"Resolved Issue\n\n{self.user.username} marked {self.short_id} as resolved in {release.version}"
            in msg.body
        )
        # check the html version
        assert (
            f'text-decoration: none">{self.short_id}</a> as resolved in' in msg.alternatives[0][0]
        )

        attachment, text = get_attachment()
        assert text == f"Issue marked as resolved in {release.version} by {self.name}"
        assert attachment["title"] == self.group.title
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user|Notification Settings>"
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=self.group.id,
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    @responses.activate
    def test_sends_processing_issue_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is held back for reprocessing
        """
        pass

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_issue_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue comes in that triggers an alert rule.
        """

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        Rule.objects.create(
            project=self.project,
            label="a rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "message": "Hello world",
                "timestamp": min_ago,
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                group_id=event.group_id,
                cache_key=cache_key,
            )

        msg = mail.outbox[0]
        # check the txt version
        assert "Details\n-------\n\n" in msg.body
        # check the html version
        assert "Hello world</pre>" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=event.group_id,
        )
        assert analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            actor_id=self.user.actor_id,
            organization_id=self.organization.id,
            group_id=event.group_id,
        )
