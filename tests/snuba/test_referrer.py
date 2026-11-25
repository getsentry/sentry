from unittest import TestCase
from unittest.mock import MagicMock, patch

from sentry.snuba.referrer import (
    Referrer,
    is_valid_client_referrer,
    resolve_client_referrer,
    validate_referrer,
)
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
        assert warn_log.call_count == 0

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_uncommon_suffixes(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        assert not validate_referrer("api.insights.http.domain-summary-transactions-list.special")
        assert not validate_referrer("api.insights.http.domain-summary-transactions-list.airyrpm")
        assert warn_log.call_count == 2

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_registered_dynamic_queries(self, warn_log: MagicMock) -> None:
        assert validate_referrer("api.auth-token.events.find-topn")
        assert validate_referrer("api.metrics.series")
        assert warn_log.call_count == 0

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

    def test_is_valid_client_referrer_accepts_client_referrers(self) -> None:
        assert is_valid_client_referrer(None)
        assert is_valid_client_referrer("")
        assert is_valid_client_referrer(Referrer.API_ORGANIZATION_EVENTS.value)
        assert is_valid_client_referrer(f"{Referrer.API_ORGANIZATION_EVENTS.value}.primary")

    def test_is_valid_client_referrer_rejects_server_only_referrers(self) -> None:
        assert not is_valid_client_referrer(Referrer.SUBSCRIPTIONS_EXECUTOR.value)
        assert not is_valid_client_referrer(f"{Referrer.SUBSCRIPTIONS_EXECUTOR.value}.primary")
        assert not is_valid_client_referrer(Referrer.TSDB_MODELID_4.value)
        assert not is_valid_client_referrer(
            Referrer.TSDB_MODELID_4_wf_batch_alert_event_frequency.value
        )

    def test_is_valid_client_referrer_rejects_unknown_referrers(self) -> None:
        assert not is_valid_client_referrer("does_not_exist")

    def test_resolve_client_referrer_keeps_valid_referrer(self) -> None:
        referrer = resolve_client_referrer(Referrer.API_EXPLORE_LOG_ITEM_DETAILS.value, "default")

        assert referrer == Referrer.API_EXPLORE_LOG_ITEM_DETAILS.value

    def test_resolve_client_referrer_defaults_when_referrer_is_missing(self) -> None:
        assert resolve_client_referrer(None, "default") == "default"
        assert resolve_client_referrer("", "default") == "default"

    def test_resolve_client_referrer_defaults_when_referrer_is_server_only(self) -> None:
        referrer = resolve_client_referrer(Referrer.SUBSCRIPTIONS_EXECUTOR.value, "default")

        assert referrer == "default"

    def test_resolve_client_referrer_defaults_when_referrer_is_unknown(self) -> None:
        assert resolve_client_referrer("does_not_exist", "default") == "default"

    @patch("sentry.snuba.referrer.logger.warning")
    def test_referrer_validate_base_enum_values(self, warn_log: MagicMock) -> None:
        assert warn_log.call_count == 0
        for i in Referrer:
            assert validate_referrer(i.value)
        assert warn_log.call_count == 0
