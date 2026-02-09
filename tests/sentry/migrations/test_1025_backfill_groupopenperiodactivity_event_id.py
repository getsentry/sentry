from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.testutils.cases import TestMigrations


class BackfillGroupOpenPeriodActivityEventIdTest(TestMigrations):
    migrate_from = "1024_delete_never_active_users_without_emails_self_hosted"
    migrate_to = "1025_backfill_groupopenperiodactivity_event_id"

    def setup_before_migration(self, apps):
        self.project = self.create_project()

        # Case 1: Open period with event_id, OPENED activity without event_id -> should backfill
        group_1 = self.create_group(project=self.project, create_open_period=False)
        self.open_period_1 = GroupOpenPeriod.objects.create(
            group=group_1,
            project=self.project,
            event_id="aaaa" * 8,
        )
        self.activity_1 = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_1,
            type=OpenPeriodActivityType.OPENED,
            event_id=None,
        )

        # Case 2: Open period with event_id, OPENED activity already has event_id -> should NOT overwrite
        group_2 = self.create_group(project=self.project, create_open_period=False)
        self.open_period_2 = GroupOpenPeriod.objects.create(
            group=group_2,
            project=self.project,
            event_id="bbbb" * 8,
        )
        self.activity_2 = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_2,
            type=OpenPeriodActivityType.OPENED,
            event_id="cccc" * 8,
        )

        # Case 3: Open period without event_id -> should be skipped
        group_3 = self.create_group(project=self.project, create_open_period=False)
        self.open_period_3 = GroupOpenPeriod.objects.create(
            group=group_3,
            project=self.project,
            event_id=None,
        )
        self.activity_3 = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_3,
            type=OpenPeriodActivityType.OPENED,
            event_id=None,
        )

        # Case 4: Open period with event_id but no OPENED activity (only CLOSED) -> should be skipped
        group_4 = self.create_group(project=self.project, create_open_period=False)
        self.open_period_4 = GroupOpenPeriod.objects.create(
            group=group_4,
            project=self.project,
            event_id="dddd" * 8,
        )
        self.activity_4 = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_4,
            type=OpenPeriodActivityType.CLOSED,
            event_id=None,
        )

        # Case 5: Open period with event_id, has both OPENED and CLOSED activities
        # -> only OPENED should get the event_id
        group_5 = self.create_group(project=self.project, create_open_period=False)
        self.open_period_5 = GroupOpenPeriod.objects.create(
            group=group_5,
            project=self.project,
            event_id="eeee" * 8,
        )
        self.activity_5_opened = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_5,
            type=OpenPeriodActivityType.OPENED,
            event_id=None,
        )
        self.activity_5_closed = GroupOpenPeriodActivity.objects.create(
            group_open_period=self.open_period_5,
            type=OpenPeriodActivityType.CLOSED,
            event_id=None,
        )

    def test(self) -> None:
        # Case 1: event_id should be backfilled from open period to activity
        self.activity_1.refresh_from_db()
        assert self.activity_1.event_id == "aaaa" * 8

        # Case 2: existing event_id should NOT be overwritten
        self.activity_2.refresh_from_db()
        assert self.activity_2.event_id == "cccc" * 8

        # Case 3: activity should still have no event_id (open period had none)
        self.activity_3.refresh_from_db()
        assert self.activity_3.event_id is None

        # Case 4: CLOSED activity should not be touched (only OPENED type is updated)
        self.activity_4.refresh_from_db()
        assert self.activity_4.event_id is None

        # Case 5: only the OPENED activity gets the event_id, CLOSED stays null
        self.activity_5_opened.refresh_from_db()
        assert self.activity_5_opened.event_id == "eeee" * 8
        self.activity_5_closed.refresh_from_db()
        assert self.activity_5_closed.event_id is None
