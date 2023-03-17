from unittest import TestCase
from unittest.mock import patch

from sentry.snuba.referrer import ReferrerBase, validate_referrer
from sentry.tsdb.base import TSDBModel


class ReferrerTest(TestCase):
    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_not_exist(self, warn_log):
        assert warn_log.call_count == 0
        validate_referrer("does_not_exist")
        assert warn_log.call_count == 1

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_dynamic_tsdb_model(self, warn_log):
        assert warn_log.call_count == 0
        for model in TSDBModel:
            validate_referrer(f"tsdb-modelid:{model.value}")
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_tsdb_4_model_with_suffix(self, warn_log):
        assert warn_log.call_count == 0
        validate_referrer("tsdb-modelid:4.user_count_snoozes")
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_base_enum_values(self, warn_log):
        assert warn_log.call_count == 0
        for i in ReferrerBase:
            validate_referrer(i.value)
        assert warn_log.call_count == 0
