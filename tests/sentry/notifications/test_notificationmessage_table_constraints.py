from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase


@pytest.mark.migrations
class TestUpdateNotificationMessageConstraintsForActionGroupOpenPeriod(TestCase):

    def setUp(self):
        # Metric Alert
        self.project = self.create_project()
        self.incident = self.create_incident()
        self.alert_rule = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.alert_rule_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
        )

        # Issue Alert
        self.rule = Rule.objects.create(project=self.project)
        self.group = self.create_group(project=self.project)
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project, rule=self.rule, group=self.group
        )

        self.action = self.create_action()

    def test_constraint_enforces_uniqueness_for_issue_alerts(self):
        """Test that the constraint prevents duplicate issue alerts without open_period_start but allows them with different open_period_start"""

        # Create first notification without open_period_start
        NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
        )

        # Attempting to create second notification without open_period_start should fail
        with pytest.raises(IntegrityError):
            NotificationMessage.objects.create(
                rule_fire_history_id=self.rule_fire_history.id,
                rule_action_uuid="test-uuid-3",
                error_code=None,
                parent_notification_message=None,
            )

    def test_constraint_allows_action_group_with_open_period_start(self):
        """Test that the new constraint allows action group notifications"""

        # Creating notifications with different open_period_start should succeed
        open_period_1 = timezone.now()
        open_period_2 = timezone.now() + timedelta(hours=1)

        notification1 = NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_1,
        )

        notification2 = NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_2,
        )

        assert notification1.open_period_start == open_period_1
        assert notification2.open_period_start == open_period_2

    def test_constraint_allows_issue_alert_with_open_period_start(self):
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

    def test_constraint_allows_different_action_group_combinations(self):
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
