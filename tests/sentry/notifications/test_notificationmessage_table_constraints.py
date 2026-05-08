from datetime import timedelta

import pytest
from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase


class TestUpdateNotificationMessageConstraintsForActionGroupOpenPeriod(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.incident = self.create_incident()
        self.alert_rule = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
        )
        self.group = self.create_group(project=self.project)
        self.action = self.create_action()

    def test_constraint_allows_issue_alert_with_open_period_start(self) -> None:
        """Test that the new constraint allows issue alert notifications"""

        group = self.create_group(project=self.project)
        action = self.create_action()

        # Creating notifications with different open_period_start should succeed
        open_period_1 = timezone.now()
        open_period_2 = timezone.now() + timedelta(hours=1)

        notification1 = NotificationMessage.objects.create(
            action_id=action.id,
            group_id=group.id,
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_1,
        )

        notification2 = NotificationMessage.objects.create(
            action_id=action.id,
            group_id=group.id,
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_2,
        )

        assert notification1.open_period_start == open_period_1
        assert notification2.open_period_start == open_period_2

    def test_pairing_rejects_incident_without_trigger_action(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create(
                incident_id=self.incident.id,
                trigger_action=None,
            )

    def test_pairing_rejects_trigger_action_without_incident(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create(
                incident=None,
                trigger_action_id=self.alert_rule_trigger_action.id,
            )

    def test_pairing_rejects_action_without_group(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create(
                action_id=self.action.id,
                group=None,
            )

    def test_pairing_rejects_group_without_action(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create(
                action=None,
                group_id=self.group.id,
            )

    def test_constraint_rejects_all_null(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create()

    def test_constraint_rejects_metric_and_workflow_set(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(NotificationMessage)),
        ):
            NotificationMessage.objects.create(
                incident_id=self.incident.id,
                trigger_action_id=self.alert_rule_trigger_action.id,
                action_id=self.action.id,
                group_id=self.group.id,
            )

    def test_constraint_allows_different_action_group_combinations(self) -> None:
        """Test that different action/group combinations are allowed"""

        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        action1 = self.create_action()
        action2 = self.create_action()

        # Create notifications with different action/group combinations
        NotificationMessage.objects.create(
            action_id=action1.id,
            group_id=group1.id,
            error_code=None,
            parent_notification_message=None,
        )

        NotificationMessage.objects.create(
            action_id=action1.id,
            group_id=group2.id,
            error_code=None,
            parent_notification_message=None,
        )

        NotificationMessage.objects.create(
            action_id=action2.id,
            group_id=group1.id,
            error_code=None,
            parent_notification_message=None,
        )

        # Verify all notifications were created successfully
        assert (
            NotificationMessage.objects.filter(
                action_id__in=[action1.id, action2.id],
                group_id__in=[group1.id, group2.id],
            ).count()
            == 3
        )
