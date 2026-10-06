from uuid import uuid4

from sentry.testutils.cases import TestMigrations


class BackfillCheckinConfigTest(TestMigrations):
    app = "monitors"
    migrate_from = "0015_add_monitorcheckin_checkin_config_index"
    migrate_to = "0016_backfill_checkin_config"
    connection = "secondary"

    def setup_before_migration(self, apps):
        Monitor = apps.get_model("monitors", "Monitor")
        MonitorEnvironment = apps.get_model("monitors", "MonitorEnvironment")
        MonitorCheckIn = apps.get_model("monitors", "MonitorCheckIn")
        MonitorCheckInConfig = apps.get_model("monitors", "MonitorCheckInConfig")

        monitor = Monitor.objects.create(
            guid=uuid4(),
            organization_id=1,
            project_id=1,
            slug="backfill",
            name="backfill",
            config={},
        )
        monitor_env = MonitorEnvironment.objects.create(monitor=monitor, environment_id=1)

        def create_checkin(**kwargs):
            return MonitorCheckIn.objects.create(
                guid=uuid4(),
                project_id=1,
                monitor=monitor,
                monitor_environment=monitor_env,
                **kwargs,
            )

        self.config_a = {"schedule": "0 * * * *", "schedule_type": 1, "checkin_margin": 5}
        self.config_b = {"schedule": "*/5 * * * *", "schedule_type": 1, "max_runtime": 30}

        self.a1 = create_checkin(monitor_config=self.config_a)
        self.a2 = create_checkin(monitor_config=dict(reversed(self.config_a.items())))
        self.b = create_checkin(monitor_config=self.config_b)
        self.no_config = create_checkin()

        self.existing_config = MonitorCheckInConfig.objects.create(
            hash="0" * 64, config=self.config_b
        )
        self.already_set = create_checkin(checkin_config_id=self.existing_config.id)

    def test_backfill(self) -> None:
        MonitorCheckIn = self.apps.get_model("monitors", "MonitorCheckIn")
        MonitorCheckInConfig = self.apps.get_model("monitors", "MonitorCheckInConfig")

        a1 = MonitorCheckIn.objects.get(id=self.a1.id)
        a2 = MonitorCheckIn.objects.get(id=self.a2.id)
        b = MonitorCheckIn.objects.get(id=self.b.id)
        no_config = MonitorCheckIn.objects.get(id=self.no_config.id)
        already_set = MonitorCheckIn.objects.get(id=self.already_set.id)

        assert a1.monitor_config == self.config_a
        assert a2.monitor_config == self.config_a
        assert b.monitor_config == self.config_b
        for checkin in (a1, a2, b):
            assert checkin.checkin_config_id is not None

        assert a1.checkin_config_id == a2.checkin_config_id
        assert MonitorCheckInConfig.objects.get(id=a1.checkin_config_id).config == self.config_a
        assert MonitorCheckInConfig.objects.get(id=b.checkin_config_id).config == self.config_b

        assert no_config.checkin_config_id is None
        assert already_set.checkin_config_id == self.existing_config.id
        assert MonitorCheckInConfig.objects.count() == 3
