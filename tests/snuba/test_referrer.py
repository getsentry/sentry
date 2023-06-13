from __future__ import annotations

import os
from unittest import TestCase
from unittest.mock import patch

from sentry.snuba import referrer
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
    def test_referrer_validate_base_enum_values(self, warn_log):
        assert warn_log.call_count == 0
        for i in ReferrerBase:
            validate_referrer(i.value)
        assert warn_log.call_count == 0


def _generate() -> str:
    with open(referrer.__file__) as f:
        src = f.read()

    start, begin, rest = src.partition("# generated: start\n")
    _, end, rest = rest.partition("# generated: end\n")

    # specific suffixes that apply to tsdb-modelid referrers, these are optional
    # and are passed around through using `referrer_suffix`.
    TSDB_MODEL_TO_SUFFIXES: dict[TSDBModel, tuple[str, ...]] = {
        TSDBModel.group: (
            "frequency_snoozes",
            "alert_event_frequency",
            "alert_event_frequency_percent",
        ),
        TSDBModel.users_affected_by_group: (
            "user_count_snoozes",
            "alert_event_uniq_user_frequency",
        ),
    }

    tsdb_model_referrer_vals = {
        f"TSDB_MODELID_{model.value}": f"tsdb-modelid:{model.value}" for model in TSDBModel
    }
    tsdb_model_suffix_referrer_vals = {
        f"TSDB_MODELID_{model.value}_{suffix}": f"tsdb-modelid:{model.value}.{suffix}"
        for model, suffixes in TSDB_MODEL_TO_SUFFIXES.items()
        for suffix in suffixes
    }
    referrer_vals = {
        **{i.name: i.value for i in referrer.ReferrerBase},
        **tsdb_model_referrer_vals,
        **tsdb_model_suffix_referrer_vals,
    }
    generated = f"""\
# fmt: off
TSDBModelReferrer = enum.Enum(
    "TSDBModelReferrer",
    {tsdb_model_referrer_vals},
)
TSDBModelSuffixReferrer = enum.Enum(
    "TSDBModelSuffixReferrer",
    {tsdb_model_suffix_referrer_vals},
)
Referrer = enum.Enum(
    "Referrer",
    {referrer_vals},
)
# fmt: on
"""
    return start + begin + generated + end + rest


def test_generation() -> None:
    expected = _generate()
    if os.environ.get("GENERATE_REFERRER_ENUMS"):
        with open(referrer.__file__, "w") as f:
            f.write(expected)

    with open(referrer.__file__) as f:
        contents = f.read()

    if contents != expected:
        raise AssertionError(
            "source and generated enums do not match!\n"
            "rerun the test with `GENERATE_REFERRER_ENUMS=1`\n\n"
        )
