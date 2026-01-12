from unittest import TestCase
from unittest.mock import MagicMock, patch

from sentry.snuba.referrer import Referrer, validate_referrer
from sentry.tsdb.base import TSDBModel


class ReferrerTest(TestCase):
    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_not_exist(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        assert not validate_referrer("does_not_exist")
        assert warn_log.call_count == 1

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_dynamic_tsdb_model(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        for model in TSDBModel:
            assert validate_referrer(f"tsdb-modelid:{model.value}")
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_tsdb_model_with_suffix(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        assert validate_referrer("tsdb-modelid:300.user_count_snoozes")
        assert warn_log.call_count == 0
        assert validate_referrer("tsdb-modelid:4.frequency_snoozes")
        assert warn_log.call_count == 0
        # tsdb-modelid:4 doesn't use the `user_count_snoozes` suffix
        assert not validate_referrer("tsdb-modelid:4.user_count_snoozes")
        assert warn_log.call_count == 1

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_common_suffixes(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        assert validate_referrer("api.insights.http.domain-summary-transactions-list")
        assert validate_referrer("api.insights.http.domain-summary-transactions-list.primary")
        assert validate_referrer("api.insights.http.domain-summary-transactions-list.secondary")
        assert validate_referrer("api.insights.http.domain-summary-transactions-list.find-topn")
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_uncommon_suffixes(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        assert not validate_referrer("api.insights.http.domain-summary-transactions-list.special")
        assert not validate_referrer("api.insights.http.domain-summary-transactions-list.airyrpm")
        assert warn_log.call_count == 2

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_tsdb_models(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        for model in TSDBModel:
            assert hasattr(Referrer, f"TSDB_MODELID_{model.value}")
            assert (
                getattr(Referrer, f"TSDB_MODELID_{model.value}").value
                == f"tsdb-modelid:{model.value}"
            )

        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_base_enum_values(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        for i in Referrer:
            assert validate_referrer(i.value)
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_find_topn_suffix(self, warn_log: MagicMock) -> None:
        """Test that the find-topn suffix is valid for organization events referrers."""
        assert warn_log.call_count == 0
        # Test the specific case from the issue
        assert validate_referrer("api.organization-events.find-topn")
        assert validate_referrer("api.organization-event-stats.find-topn")
        # Test that find-topn works with other common referrers
        assert validate_referrer("api.discover.top5-chart.find-topn")
        assert validate_referrer("api.dashboards.widget.area-chart.find-topn")
        assert warn_log.call_count == 0
