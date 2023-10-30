from unittest import TestCase
from unittest.mock import patch

from sentry.snuba.referrer import Referrer, validate_referrer
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
    def test_referrer_validate_tsdb_model_with_suffix(self, warn_log):
        assert warn_log.call_count == 0
        validate_referrer("tsdb-modelid:300.user_count_snoozes")
        assert warn_log.call_count == 0
        validate_referrer("tsdb-modelid:4.frequency_snoozes")
        assert warn_log.call_count == 0
        # tsdb-modelid:4 doesn't use the `user_count_snoozes` suffix
        validate_referrer("tsdb-modelid:4.user_count_snoozes")
        assert warn_log.call_count == 1

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_tsdb_models(self, warn_log):
        assert warn_log.call_count == 0
        for model in TSDBModel:
            assert hasattr(Referrer, f"TSDB_MODELID_{model.value}")
            assert (
                getattr(Referrer, f"TSDB_MODELID_{model.value}").value
                == f"tsdb-modelid:{model.value}"
            )

        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_base_enum_values(self, warn_log):
        assert warn_log.call_count == 0
        for i in Referrer:
            validate_referrer(i.value)
        assert warn_log.call_count == 0
