from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    compute_adjusted_factor,
    generate_recalibrate_orgs_cache_key,
    get_adjusted_factor,
    set_guarded_adjusted_factor,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.mark.parametrize(
    "prev_factor,actual_rate,desired_sample_rate,expected_adj_factor",
    [
        (1.0, 1.0, 1.0, 1.0),
        (1.0, 0.1, 0.036, 0.35999999999999993),  # emulate sentry
        (0.35999999999999993, 0.036, 0.036, 0.35999999999999993),  # emulate sentry
        (1.0, 0.25, 0.5, 2.0),
        (1.0, 0, 0.5, None),
        (0.0, 0.25, 0.5, None),
    ],
)
def test_adjusted_factor(
    prev_factor: float, actual_rate: float, desired_sample_rate: float, expected_adj_factor: float
) -> None:
    assert (
        compute_adjusted_factor(prev_factor, actual_rate, desired_sample_rate)
        == expected_adj_factor
    )


@django_db_all
@override_options({"dynamic-sampling.recalibration.factor-ttl-minutes": 25})
def test_set_guarded_adjusted_factor_uses_ttl_option() -> None:
    org_id = 1234
    cache_key = generate_recalibrate_orgs_cache_key(org_id)
    redis_client = get_redis_client_for_ds()
    redis_client.delete(cache_key)

    set_guarded_adjusted_factor(org_id, 2.0)

    assert 24 * 60 * 1000 < redis_client.pttl(cache_key) <= 25 * 60 * 1000


@django_db_all
def test_get_adjusted_factor_records_hit_and_miss() -> None:
    org_id = 1235
    cache_key = generate_recalibrate_orgs_cache_key(org_id)
    redis_client = get_redis_client_for_ds()
    redis_client.delete(cache_key)

    with patch("sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs.metrics.incr") as incr:
        assert get_adjusted_factor(org_id, source="serving") == 1.0
        incr.assert_called_once_with(
            "dynamic_sampling.tasks.recalibrate_orgs.get_adjusted_factor",
            tags={"source": "serving", "result": "miss"},
        )

    set_guarded_adjusted_factor(org_id, 2.0)

    with patch("sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs.metrics.incr") as incr:
        assert get_adjusted_factor(org_id, source="task") == 2.0
        incr.assert_called_once_with(
            "dynamic_sampling.tasks.recalibrate_orgs.get_adjusted_factor",
            tags={"source": "task", "result": "hit"},
        )
