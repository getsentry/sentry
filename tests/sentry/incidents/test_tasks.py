from __future__ import absolute_import

import six

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from exam import fixture, patcher
from freezegun import freeze_time
from sentry.utils.compat.mock import Mock, patch

from sentry.incidents.logic import (
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident_activity,
    subscribe_to_incident,
)
from sentry.incidents.models import (
    AlertRuleTriggerAction,
    IncidentActivityType,
    IncidentStatus,
    INCIDENT_STATUS,
    IncidentSubscription,
    PendingIncidentSnapshot,
    IncidentSnapshot,
)
from sentry.incidents.tasks import (
    build_activity_context,
    generate_incident_activity_email,
    handle_trigger_action,
    send_subscriber_notifications,
    process_pending_incident_snapshots,
)
from sentry.testutils import TestCase
from sentry.utils.http import absolute_uri


class BaseIncidentActivityTest(object):
    @property
    def incident(self):
        return self.create_incident(title="hello")


class TestSendSubscriberNotifications(BaseIncidentActivityTest, TestCase):
    send_async = patcher("sentry.utils.email.MessageBuilder.send_async")

    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        send_subscriber_notifications(activity.id)
        # User shouldn't receive an email for their own activity
        self.send_async.assert_not_called()  # NOQA

        self.send_async.reset_mock()
        non_member_user = self.create_user(email="non_member@test.com")
        subscribe_to_incident(activity.incident, non_member_user)

        member_user = self.create_user(email="member@test.com")
        self.create_member([self.team], user=member_user, organization=self.organization)
        subscribe_to_incident(activity.incident, member_user)
        send_subscriber_notifications(activity.id)
        self.send_async.assert_called_once_with([member_user.email])
        assert not IncidentSubscription.objects.filter(
            incident=activity.incident, user=non_member_user
        ).exists()
        assert IncidentSubscription.objects.filter(
            incident=activity.incident, user=member_user
        ).exists()

    def test_invalid_types(self):
        activity_type = IncidentActivityType.CREATED
        activity = create_incident_activity(self.incident, activity_type)
        send_subscriber_notifications(activity.id)
        self.send_async.assert_not_called()  # NOQA
        self.send_async.reset_mock()


class TestGenerateIncidentActivityEmail(BaseIncidentActivityTest, TestCase):
    @freeze_time()
    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        incident = activity.incident
        recipient = self.create_user()
        message = generate_incident_activity_email(activity, recipient)
        assert message.subject == "Activity on Alert {} (#{})".format(
            incident.title, incident.identifier
        )
        assert message.type == "incident.activity"
        assert message.context == build_activity_context(activity, recipient)


class TestBuildActivityContext(BaseIncidentActivityTest, TestCase):
    def run_test(
        self, activity, expected_username, expected_action, expected_comment, expected_recipient
    ):
        incident = activity.incident
        context = build_activity_context(activity, expected_recipient)
        assert context["user_name"] == expected_username
        assert context["action"] == "%s on alert %s (#%s)" % (
            expected_action,
            activity.incident.title,
            activity.incident.identifier,
        )
        assert (
            context["link"]
            == absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            )
            + "?referrer=incident_activity_email"
        )
        assert context["comment"] == expected_comment

    @freeze_time()
    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        recipient = self.create_user()
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action="left a comment",
            expected_comment=activity.comment,
            expected_recipient=recipient,
        )
        activity.type = IncidentActivityType.STATUS_CHANGE
        activity.value = six.text_type(IncidentStatus.CLOSED.value)
        activity.previous_value = six.text_type(IncidentStatus.WARNING.value)
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action="changed status from %s to %s"
            % (INCIDENT_STATUS[IncidentStatus.WARNING], INCIDENT_STATUS[IncidentStatus.CLOSED]),
            expected_comment=activity.comment,
            expected_recipient=recipient,
        )


class HandleTriggerActionTest(TestCase):
    metrics = patcher("sentry.incidents.tasks.metrics")

    @fixture
    def alert_rule(self):
        return self.create_alert_rule()

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "", 100)

    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

    def test_missing_trigger_action(self):
        with self.tasks():
            handle_trigger_action.delay(1000, 1001, self.project.id, "hello")
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_action"
        )

    def test_missing_incident(self):
        with self.tasks():
            handle_trigger_action.delay(self.action.id, 1001, self.project.id, "hello")
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_incident"
        )

    def test_missing_project(self):
        incident = self.create_incident()
        with self.tasks():
            handle_trigger_action.delay(self.action.id, incident.id, 1002, "hello")
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_project"
        )

    def test(self):
        with patch.object(AlertRuleTriggerAction, "_type_registrations", new={}):
            mock_handler = Mock()
            AlertRuleTriggerAction.register_type("email", AlertRuleTriggerAction.Type.EMAIL, [])(
                mock_handler
            )
            incident = self.create_incident()
            metric_value = 1234
            with self.tasks():
                handle_trigger_action.delay(
                    self.action.id, incident.id, self.project.id, "fire", metric_value=metric_value
                )
            mock_handler.assert_called_once_with(self.action, incident, self.project)
            mock_handler.return_value.fire.assert_called_once_with(metric_value)


class ProcessPendingIncidentSnapshots(TestCase):
    def test_simple(self):
        incident = self.create_incident(title="incident", status=IncidentStatus.CLOSED.value)
        pending = PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=timezone.now()
        )

        assert IncidentSnapshot.objects.all().count() == 0

        with self.tasks():
            process_pending_incident_snapshots()

        assert not PendingIncidentSnapshot.objects.filter(id=pending.id).exists()
        assert IncidentSnapshot.objects.filter(incident=incident).exists()

    def test_skip_open_incident(self):
        incident = self.create_incident(title="incident", status=IncidentStatus.OPEN.value)
        pending = PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=timezone.now()
        )
        assert IncidentSnapshot.objects.all().count() == 0

        with self.tasks():
            process_pending_incident_snapshots()

        # The PendingSnapshot should be deleted, and a Snapshot should not be created because the incident is open.
        assert not PendingIncidentSnapshot.objects.filter(id=pending.id).exists()
        assert not IncidentSnapshot.objects.filter(incident=incident).exists()

    def test_skip_future_run_date(self):
        incident_1 = self.create_incident(title="incident1", status=IncidentStatus.CLOSED.value)
        incident_2 = self.create_incident(title="incident2", status=IncidentStatus.CLOSED.value)
        pending_1 = PendingIncidentSnapshot.objects.create(
            incident=incident_1, target_run_date=timezone.now()
        )
        pending_2 = PendingIncidentSnapshot.objects.create(
            incident=incident_2, target_run_date=timezone.now() + timedelta(minutes=5)
        )

        assert IncidentSnapshot.objects.all().count() == 0

        with self.tasks():
            process_pending_incident_snapshots()

        # Should only process the one with target_run_date <= timezone.now()
        assert not PendingIncidentSnapshot.objects.filter(id=pending_1.id).exists()
        assert PendingIncidentSnapshot.objects.filter(id=pending_2.id).exists()

        assert IncidentSnapshot.objects.filter(incident=incident_1).exists()
        assert not IncidentSnapshot.objects.filter(incident=incident_2).exists()

    def test_skip_because_existing_snapshot(self):
        incident = self.create_incident(title="incident1", status=IncidentStatus.CLOSED.value)
        pending_1 = PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=timezone.now()
        )

        assert IncidentSnapshot.objects.all().count() == 0

        with self.tasks():
            process_pending_incident_snapshots()

        assert not PendingIncidentSnapshot.objects.filter(id=pending_1.id).exists()
        assert IncidentSnapshot.objects.filter(incident=incident).exists()
        assert IncidentSnapshot.objects.all().count() == 1

        # Have to create it here otherwise the unique constraint will cause this to fail:
        pending_2 = PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=timezone.now()
        )
        with self.tasks():
            process_pending_incident_snapshots()

        assert not PendingIncidentSnapshot.objects.filter(id=pending_2.id).exists()
        assert IncidentSnapshot.objects.filter(incident=incident).exists()
        assert IncidentSnapshot.objects.filter(incident=incident).count() == 1
        assert IncidentSnapshot.objects.all().count() == 1
