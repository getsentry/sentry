from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestMigrations


class TestAddActionColsToThreadsModel(TestMigrations):
    migrate_from = "0815_add_action_cols_to_threads_model"
    migrate_to = "0816_update_notificationmessage_constraints_for_action_group_open_period"

    def setup_before_migration(self, apps):
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
        self.open_period_start = timezone.now()

        self.apps = apps

        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

        # Create a notification for a metric alert
        self.metric_notification = NotificationMessage.objects.create(
            incident_id=self.incident.id,
            trigger_action_id=self.alert_rule_trigger_action.id,
            error_code=None,
            parent_notification_message=None,
        )

        # Create a notification for an issue alert
        self.issue_notification = NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="test-uuid",
            error_code=None,
            parent_notification_message=None,
        )

    def test_migration_adds_new_fields(self):
        """Test that the new fields are added with correct nullability"""
        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

        # Test that existing records can be retrieved
        metric_notification = NotificationMessage.objects.get(incident_id=self.incident.id)
        issue_notification = NotificationMessage.objects.get(
            rule_fire_history_id=self.rule_fire_history.id
        )

        # Verify new fields are added with null values
        assert metric_notification.action_id is None
        assert metric_notification.group_id is None
        assert metric_notification.open_period_start is None

        assert issue_notification.action_id is None
        assert issue_notification.group_id is None
        assert issue_notification.open_period_start is None

    def test_constraint_allows_issue_alert_with_open_period_start(self):
        """Test that the new constraint allows issue alert notifications"""
        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

        rule = Rule.objects.create(project=self.project)
        group = self.create_group(project=self.project)
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project, rule=rule, group=group
        )

        open_period_start = timezone.now() + timedelta(days=1)

        # Should not raise any constraint violations
        notification = NotificationMessage.objects.create(
            rule_fire_history_id=rule_fire_history.id,
            rule_action_uuid="test-uuid-2",
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_start,
        )
        notification.refresh_from_db()

        # Fetch the notification from the database should only return the one we created
        notification = NotificationMessage.objects.get(
            rule_fire_history_id=rule_fire_history.id,
            rule_action_uuid="test-uuid-2",
            open_period_start=open_period_start,
        )

        assert notification is not None
        assert notification.open_period_start == open_period_start

    def test_constraint_enforces_uniqueness_for_issue_alerts(self):
        """Test that the constraint prevents duplicate issue alerts without open_period_start but allows them with different open_period_start"""
        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

        rule = Rule.objects.create(project=self.project)
        group = self.create_group(project=self.project)
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project, rule=rule, group=group
        )

        # Create first notification without open_period_start
        NotificationMessage.objects.create(
            rule_fire_history_id=rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
        )

        # Attempting to create second notification without open_period_start should fail
        with pytest.raises(IntegrityError):
            NotificationMessage.objects.create(
                rule_fire_history_id=rule_fire_history.id,
                rule_action_uuid="test-uuid-3",
                error_code=None,
                parent_notification_message=None,
            )

        # Creating notifications with different open_period_start should succeed
        open_period_1 = timezone.now()
        open_period_2 = timezone.now() + timedelta(hours=1)

        notification1 = NotificationMessage.objects.create(
            rule_fire_history_id=rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_1,
        )

        notification2 = NotificationMessage.objects.create(
            rule_fire_history_id=rule_fire_history.id,
            rule_action_uuid="test-uuid-3",
            error_code=None,
            parent_notification_message=None,
            open_period_start=open_period_2,
        )

        assert notification1.open_period_start == open_period_1
        assert notification2.open_period_start == open_period_2

    def test_constraint_enforces_uniqueness_for_action_group(self):
        """Test that the constraint prevents duplicate action/group combinations without open_period_start but allows them with different open_period_start"""
        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

        group = self.create_group(project=self.project)
        action = self.create_action()

        # Create first notification without open_period_start
        NotificationMessage.objects.create(
            action_id=action.id,
            group_id=group.id,
            error_code=None,
            parent_notification_message=None,
        )

        # Attempting to create second notification without open_period_start should fail
        with pytest.raises(IntegrityError):
            NotificationMessage.objects.create(
                action_id=action.id,
                group_id=group.id,
                error_code=None,
                parent_notification_message=None,
            )

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
        NotificationMessage = self.apps.get_model("sentry", "NotificationMessage")

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
