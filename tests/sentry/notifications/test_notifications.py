import logging
import uuid
from time import time
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import responses
from django.conf import settings
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives
from django.utils import timezone
from sentry_relay.processing import parse_release

from sentry.digests.notifications import Notification
from sentry.event_manager import EventManager
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.identity import Identity, IdentityStatus
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.options.user_option import UserOption
from sentry.models.rule import Rule
from sentry.notifications.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.notifications.activity.regression import RegressionActivityNotification
from sentry.silo.base import SiloMode
from sentry.tasks.post_process import post_process_group
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils import json

pytestmark = [requires_snuba]


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


def get_blocks():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "text" in data
    assert "blocks" in data

    blocks = json.loads(data["blocks"][0])

    # title with link, text, footer
    if blocks[1]["type"] == "context":
        title_block = blocks[1]["elements"][0]["text"]
    else:
        title_block = blocks[1]["text"]["text"]

    url_block = blocks[-1].get("elements")
    if url_block:
        url_block = url_block[0].get("url")

    # assume the divider is the last element
    footer = blocks[-2].get("elements")
    if footer:
        footer = footer[0].get("text")
    # otherwise try to get footer from the last element
    if not footer:
        footer = blocks[-1]["elements"][0]["text"]

    return title_block, data["text"][0], footer, url_block


def get_notification_uuid(url: str):
    query_params = parse_qs(urlparse(url).query)
    notification_uuid = query_params["notification_uuid"][0].split("|")[0]
    assert len(notification_uuid) > 1
    return notification_uuid


@control_silo_test
class ActivityNotificationTest(APITestCase):
    """
    Enable Slack AND email notification settings for a user
    """

    def setUp(self):
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        self.login_as(self.user)
        # modify settings
        for type in ["workflow", "deploy", "alerts"]:
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type=type,
                value="always",
            )

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        responses.add_passthru(
            settings.SENTRY_SNUBA + "/tests/entities/generic_metrics_counters/insert",
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
        with assume_test_silo_mode(SiloMode.REGION):
            with self.tasks():
                response = self.client.post(url, format="json", data={"text": "blah blah"})
            assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert "blah blah" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert "blah blah</p></div>" in msg.alternatives[0][0]

        block, text, footer, url = get_blocks()
        # check the Slack version
        assert text == f"New comment by {self.name}"
        assert self.group.title in block
        title_link = block  # removes emoji and <>
        notification_uuid = get_notification_uuid(block)
        assert (
            f"http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=note_activity-slack&notification_uuid={notification_uuid}"
        ) in title_link
        assert title_link.split("\n")[-1] == "blah blah"
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=note_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @responses.activate
    def test_sends_unassignment_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is unassigned.
        """
        url = f"/api/0/issues/{self.group.id}/"
        with assume_test_silo_mode(SiloMode.REGION):
            GroupAssignee.objects.create(
                group=self.group,
                project=self.project,
                user_id=self.user.id,
                date_added=timezone.now(),
            )
            with self.tasks():
                response = self.client.put(url, format="json", data={"assignedTo": ""})
            assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"Unassigned\n\n{self.user.username} unassigned {self.short_id}" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert f"{self.user.username}</strong> unassigned" in msg.alternatives[0][0]

        block, text, footer, url = get_blocks()

        assert text == f"Issue unassigned by {self.name}"
        assert self.group.title in block
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=unassigned_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

    @responses.activate
    def test_html_escape(self):
        other_user = self.create_user(name="<b>test</b>", is_staff=False, is_superuser=False)
        activity = Activity(
            project=self.project, data={"assignee": other_user.id}, group=self.group
        )
        notification = AssignedActivityNotification(activity)

        html = notification.get_context()["html_description"]

        assert "&lt;b&gt;test&lt;/b&gt;" in html
        assert "<b>test</b>" not in html

    @responses.activate
    def test_regression_html_link(self):
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.SET_REGRESSION,
                data={"version": "777"},
            )
        )
        context = notification.get_context()

        assert "as a regression in 777" in context["text_description"]
        assert "as a regression in <a href=" in context["html_description"]

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_resolution_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is resolved.
        """
        url = f"/api/0/issues/{self.group.id}/"
        with assume_test_silo_mode(SiloMode.MONOLITH):
            with self.tasks():
                response = self.client.put(url, format="json", data={"status": "resolved"})
            assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"{self.user.username} marked {self.short_id} as resolved" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert f"{self.short_id}</a> as resolved</p>" in msg.alternatives[0][0]

        block, text, footer, url = get_blocks()

        assert self.group.title in block
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert (
            text
            == f"{self.name} marked <http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=activity_notification&notification_uuid={notification_uuid}|{self.short_id}> as resolved"
        )
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )

        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=self.group.id,
            notification_uuid=notification_uuid,
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=self.group.id,
            notification_uuid=notification_uuid,
            actor_type="User",
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
        with assume_test_silo_mode(SiloMode.REGION):
            url = (
                f"/api/0/organizations/{self.organization.slug}/releases/{release.version}/deploys/"
            )
            with self.tasks():
                response = self.client.post(
                    url, format="json", data={"environment": self.environment.name}
                )
            assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"Version {version_parsed} was deployed to {self.environment.name} on" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert (
            f"Version {version_parsed} was deployed to {self.environment.name}\n    </h2>\n"
            in msg.alternatives[0][0]
        )

        block, text, footer, url = get_blocks()

        assert (
            text
            == f"Release {version_parsed} was deployed to {self.environment.name} for this project"
        )
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert url == (
            f"http://testserver/organizations/{self.organization.slug}/releases/{release.version}/?project={self.project.id}&unselectedSeries=Healthy&referrer=release_activity&notification_uuid={notification_uuid}"
        )
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/deploy/?referrer=release_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=None,
            notification_uuid=notification_uuid,
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=None,
            notification_uuid=notification_uuid,
            actor_type="User",
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
        with assume_test_silo_mode(SiloMode.REGION):
            manager = EventManager(make_event(event_id="a" * 32, checksum="a" * 32, timestamp=ts))
            with self.tasks():
                event = manager.save(self.project.id)

            group = Group.objects.get(id=event.group_id)
            group.status = GroupStatus.RESOLVED
            group.substatus = None
            group.save()
            assert group.is_resolved()

            manager = EventManager(
                make_event(event_id="b" * 32, checksum="a" * 32, timestamp=ts + 50)
            )
            with self.tasks():
                event2 = manager.save(self.project.id)
            assert event.group_id == event2.group_id

            group = Group.objects.get(id=group.id)
            assert not group.is_resolved()

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"Sentry marked {group.qualified_short_id} as a regression" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert f"{group.qualified_short_id}</a> as a regression</p>" in msg.alternatives[0][0]

        block, text, footer, url = get_blocks()

        assert text == "Issue marked as regression"
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=regression_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=group.id,
            notification_uuid=notification_uuid,
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=group.id,
            notification_uuid=notification_uuid,
            actor_type="User",
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_sends_resolved_in_release_notification(self, record_analytics):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is resolved by a release.
        """
        release = self.create_release()
        with assume_test_silo_mode(SiloMode.MONOLITH):
            url = f"/api/0/issues/{self.group.id}/"
            with self.tasks():
                response = self.client.put(
                    url,
                    format="json",
                    data={"status": "resolved", "statusDetails": {"inRelease": release.version}},
                )
            assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        parsed_version = parse_release(release.version)["description"]
        # check the txt version
        assert (
            f"Resolved Issue\n\n{self.user.username} marked {self.short_id} as resolved in {parsed_version}"
            in msg.body
        )
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert (
            f'text-decoration: none">{self.short_id}</a> as resolved in' in msg.alternatives[0][0]
        )

        block, text, footer, url = get_blocks()

        assert text == f"Issue marked as resolved in {parsed_version} by {self.name}"
        assert self.group.title in block
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=resolved_in_release_activity-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=self.group.id,
            notification_uuid=notification_uuid,
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=self.group.id,
            notification_uuid=notification_uuid,
            actor_type="User",
        )

    @responses.activate
    def test_sends_processing_issue_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is held back for reprocessing
        """

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
        with assume_test_silo_mode(SiloMode.MONOLITH):
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
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert "Details\n-------\n\n" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert "Hello world</pre>" in msg.alternatives[0][0]

        block, text, footer, url = get_blocks()

        assert "Hello world" in block
        title_link = block[13:][1:-1]  # removes emoji and <>
        notification_uuid = get_notification_uuid(title_link)
        assert (
            footer
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={self.organization.id}|Notification Settings>"
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.email.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=event.group_id,
            notification_uuid=notification_uuid,
        )
        assert self.analytics_called_with_args(
            record_analytics,
            "integrations.slack.notification_sent",
            user_id=self.user.id,
            organization_id=self.organization.id,
            group_id=event.group_id,
            notification_uuid=notification_uuid,
            actor_type="User",
        )


class NotificationTupleTest(APITestCase):
    def test_missing_notification_uuid(self):
        rule = self.create_project_rule()
        group = self.create_group()
        notification = Notification(rule, group)
        assert notification.notification_uuid is None

    def test_notification_uuid(self):
        rule = self.create_project_rule()
        group = self.create_group()
        notification = Notification(rule, group, notification_uuid=str(uuid.uuid4()))
        assert notification.notification_uuid is not None
