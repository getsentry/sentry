from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    get_transactions_resampling_rates,
    set_transactions_resampling_rates,
)


def test_resampling_rates_in_cache():
    """
    Tests that we can correctly store and retrieve resampling rates without
    key clashes
    """
    org_id = 1
    proj_id = 10
    other_org_id = 2
    other_proj_id = 20

    expected_global_rate = 0.3
    expected_trans_rates = [
        RebalancedItem(id="t1", count=1, new_sample_rate=0.6),
        RebalancedItem(id="t2", count=1, new_sample_rate=0.7),
    ]
    expected_trans_rates_dict = {elm.id: elm.new_sample_rate for elm in expected_trans_rates}

    other_rate = 0.1
    other_rates = [RebalancedItem(id="t11", new_sample_rate=0.1, count=1)]

    # store our desired transaction rate
    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=proj_id,
        named_rates=expected_trans_rates,
        default_rate=expected_global_rate,
        ttl_ms=100 * 1000,
    )

    # store some garbage to check we don't accidentally override our info
    set_transactions_resampling_rates(
        org_id=other_org_id,
        proj_id=proj_id,
        named_rates=other_rates,
        default_rate=other_rate,
        ttl_ms=100 * 1000,
    )
    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=other_proj_id,
        named_rates=other_rates,
        default_rate=other_rate,
        ttl_ms=100 * 1000,
    )

    actual_trans_rates, actual_global_rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=proj_id, default_rate=1.0
    )

    assert actual_trans_rates == expected_trans_rates_dict
    assert actual_global_rate == expected_global_rate


def test_resampling_rates_missing():
    """
    Tests that if the resampling rates are not in cache the default values are returned
    """
    org_id = 1
    proj_id = 10
    other_org_id = 2
    other_proj_id = 20

    other_rate = 0.1
    other_rates = [RebalancedItem(id="t11", count=1, new_sample_rate=0.1)]

    # store some garbage to check we don't accidentally return other keys
    set_transactions_resampling_rates(
        org_id=other_org_id,
        proj_id=proj_id,
        named_rates=other_rates,
        default_rate=other_rate,
        ttl_ms=100 * 1000,
    )
    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=other_proj_id,
        named_rates=other_rates,
        default_rate=other_rate,
        ttl_ms=100 * 1000,
    )

    expected_global_rate = 0.33
    actual_trans_rates, actual_global_rate = get_transactions_resampling_rates(
        org_id=org_id, proj_id=proj_id, default_rate=expected_global_rate
    )

    assert actual_trans_rates == {}
    assert actual_global_rate == expected_global_rate
