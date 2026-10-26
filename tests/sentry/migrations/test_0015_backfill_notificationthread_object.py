from sentry.testutils.cases import TestMigrations


class BackfillNotificationThreadObjectTest(TestMigrations):
    app = "notifications"
    migrate_from = "0014_add_notificationthread_object"
    migrate_to = "0015_backfill_notificationthread_object"

    def setup_before_migration(self, apps):
        NotificationThread = apps.get_model("notifications", "NotificationThread")
        thread_keys = iter(range(100))

        def create(key_type, key_data, **kwargs):
            return NotificationThread.objects.create(
                thread_key=f"thread-key-{next(thread_keys)}",
                provider_key="slack",
                target_id="C1234",
                thread_identifier="1700000000.000001",
                key_type=key_type,
                key_data=key_data,
                **kwargs,
            )

        self.metric_thread = create(
            "metric-alert",
            {"action_id": 1, "group_id": 123, "open_period_start": "2026-01-01T00:00:00"},
        )
        self.issue_thread = create("issue", {"action_id": 2, "group_id": 456})
        self.already_set = create(
            "issue", {"action_id": 3, "group_id": 789}, object_type="group", object_id=999
        )
        self.other_type = create("test", {"group_id": 321})
        self.no_group = create("metric-alert", {"action_id": 4})

    def test_backfill(self):
        self.metric_thread.refresh_from_db()
        assert (self.metric_thread.object_type, self.metric_thread.object_id) == ("group", 123)

        self.issue_thread.refresh_from_db()
        assert (self.issue_thread.object_type, self.issue_thread.object_id) == ("group", 456)

        self.already_set.refresh_from_db()
        assert (self.already_set.object_type, self.already_set.object_id) == ("group", 999)

        self.other_type.refresh_from_db()
        assert (self.other_type.object_type, self.other_type.object_id) == (None, None)

        self.no_group.refresh_from_db()
        assert (self.no_group.object_type, self.no_group.object_id) == (None, None)
