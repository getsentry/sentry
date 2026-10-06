from django.db import router

from sentry.monitors.logic.checkin_config import (
    clear_checkin_config_cache,
    get_checkin_config_id,
    hash_checkin_config,
)
from sentry.monitors.models import MonitorCheckInConfig
from sentry.testutils.cases import TestCase


class GetCheckinConfigIdTest(TestCase):
    def test_dedupes_configs(self) -> None:
        config = {"schedule": "0 * * * *", "schedule_type": 1, "checkin_margin": 5}
        reordered = {"checkin_margin": 5, "schedule_type": 1, "schedule": "0 * * * *"}
        other = {**config, "checkin_margin": 10}

        assert hash_checkin_config(config) == hash_checkin_config(reordered)

        config_id = get_checkin_config_id(config)
        clear_checkin_config_cache()
        assert get_checkin_config_id(reordered) == config_id
        assert get_checkin_config_id(other) != config_id

        assert MonitorCheckInConfig.objects.count() == 2
        assert MonitorCheckInConfig.objects.get(id=config_id).config == config

    def test_caches_config_id(self) -> None:
        config = {"schedule": "0 * * * *", "schedule_type": 1}
        config_id = get_checkin_config_id(config)

        with self.assertNumQueries(0, using=router.db_for_write(MonitorCheckInConfig)):
            assert get_checkin_config_id(config) == config_id
