from collections.abc import Sequence

import pytest

from sentry.dynamic_sampling.models.base import InvalidModelInputError
from sentry.dynamic_sampling.models.common import RebalancedItem, sum_classes_counts
from sentry.dynamic_sampling.models.transactions_rebalancing import (
    TransactionsRebalancingInput,
    TransactionsRebalancingModel,
)


@pytest.fixture
def transactions_rebalancing_model():
    return TransactionsRebalancingModel()


def _run(
    model: TransactionsRebalancingModel,
    *,
    classes: list[RebalancedItem],
    sample_rate: float,
    total_num_classes: int,
    total: float,
    intensity: float = 1.0,
    min_sample_rate: float = 0.0,
) -> tuple[list[RebalancedItem], float]:
    return model.run(
        TransactionsRebalancingInput(
            classes=classes,
            sample_rate=sample_rate,
            total_num_classes=total_num_classes,
            total=total,
            intensity=intensity,
            min_sample_rate=min_sample_rate,
        )
    )


def _overall_kept(
    explicit_rates: Sequence[RebalancedItem], implicit_rate: float, total: float
) -> float:
    """Expected number of kept samples across explicit classes and the implicit (tail) classes."""
    explicit_kept = sum(item.new_sample_rate * item.count for item in explicit_rates)
    total_implicit = total - sum_classes_counts(list(explicit_rates))
    return explicit_kept + implicit_rate * total_implicit


def test_high_class_count_crushes_dominant_transaction_without_floor(
    transactions_rebalancing_model,
) -> None:
    """
    Reproduces TET-2535: one transaction carrying half the project volume while competing against a
    very large number of low-volume classes. With no floor the per-class ideal collapses, the
    dominant transaction is driven to a ~1e-6 rate (a ~1,000,000x extrapolation factor) and is
    expected to keep only ~1 raw sample - the spiky "lottery" behaviour we want to remove.
    """
    big = RebalancedItem(id="big", count=1_000_000)

    explicit_rates, implicit_rate = _run(
        transactions_rebalancing_model,
        classes=[big],
        sample_rate=0.05,
        total_num_classes=100_000,
        total=2_000_000,
        min_sample_rate=0.0,
    )

    (big_rate,) = explicit_rates
    assert big_rate.new_sample_rate == pytest.approx(1e-6)
    # the dominant transaction expects to keep ~1 raw sample, yet the tail is sampled ~100,000x denser
    assert big_rate.new_sample_rate * big_rate.count == pytest.approx(1.0)
    assert implicit_rate == pytest.approx(0.099999)
    assert implicit_rate / big_rate.new_sample_rate == pytest.approx(99999.0)


def test_min_sample_rate_floors_dominant_transaction(transactions_rebalancing_model) -> None:
    """
    Same scenario as above, but with the floor enabled: the dominant transaction's rate is floored
    so its extrapolation factor is capped at 1 / min_sample_rate, the cost is reclaimed from the
    implicit tail, and the overall sampling rate is still maintained exactly.
    """
    big = RebalancedItem(id="big", count=1_000_000)

    explicit_rates, implicit_rate = _run(
        transactions_rebalancing_model,
        classes=[big],
        sample_rate=0.05,
        total_num_classes=100_000,
        total=2_000_000,
        min_sample_rate=0.001,
    )

    (big_rate,) = explicit_rates
    # rate floored to 0.001 => extrapolation factor capped at 1000 (was 1,000,000)
    assert big_rate.new_sample_rate == pytest.approx(0.001)
    # expected kept samples jump from ~1 to ~1000, killing the shot noise
    assert big_rate.new_sample_rate * big_rate.count == pytest.approx(1000.0)
    # the budget is reclaimed by lowering the tail rate, not by exceeding the overall budget
    assert implicit_rate == pytest.approx(0.099)
    assert _overall_kept(explicit_rates, implicit_rate, total=2_000_000) == pytest.approx(
        0.05 * 2_000_000
    )


def test_min_sample_rate_with_many_explicit_transactions(transactions_rebalancing_model) -> None:
    """
    Production-shaped case: 30 high-volume explicit transactions (60% of volume) competing with a
    ~50k-class tail. Without the floor every head transaction collapses to a 5e-5 rate (20,000x
    factor); with the floor they are lifted to the floor and the tail rate barely moves.
    """
    classes = [RebalancedItem(id=f"big{i}", count=20_000) for i in range(30)]

    no_floor_rates, no_floor_implicit = _run(
        transactions_rebalancing_model,
        classes=classes,
        sample_rate=0.05,
        total_num_classes=50_000,
        total=1_000_000,
        min_sample_rate=0.0,
    )
    assert all(item.new_sample_rate == pytest.approx(5e-5) for item in no_floor_rates)

    floored_rates, floored_implicit = _run(
        transactions_rebalancing_model,
        classes=classes,
        sample_rate=0.05,
        total_num_classes=50_000,
        total=1_000_000,
        min_sample_rate=0.001,
    )

    assert all(item.new_sample_rate == pytest.approx(0.001) for item in floored_rates)
    # reclaimed from the tail; the implicit rate drops but stays well above zero
    assert floored_implicit < no_floor_implicit
    assert floored_implicit == pytest.approx(0.1235)
    assert _overall_kept(floored_rates, floored_implicit, total=1_000_000) == pytest.approx(
        0.05 * 1_000_000
    )


def test_min_sample_rate_clamped_to_overall_rate(transactions_rebalancing_model) -> None:
    """
    For a project whose overall rate is already below the configured floor, the floor is clamped to
    the overall rate, so a class is never sampled above the project rate and the budget cannot be
    overshot.
    """
    big = RebalancedItem(id="big", count=1_000_000)

    explicit_rates, implicit_rate = _run(
        transactions_rebalancing_model,
        classes=[big],
        sample_rate=0.0005,
        total_num_classes=100_000,
        total=2_000_000,
        min_sample_rate=0.001,
    )

    (big_rate,) = explicit_rates
    assert big_rate.new_sample_rate == pytest.approx(0.0005)
    assert big_rate.new_sample_rate <= 0.0005
    assert _overall_kept(explicit_rates, implicit_rate, total=2_000_000) == pytest.approx(
        0.0005 * 2_000_000
    )


def test_min_sample_rate_inert_when_rates_healthy(transactions_rebalancing_model) -> None:
    """When the natural rates already sit above the floor, enabling it changes nothing."""
    classes = [RebalancedItem(id=f"big{i}", count=1000) for i in range(3)]

    base_rates, base_implicit = _run(
        transactions_rebalancing_model,
        classes=classes,
        sample_rate=0.5,
        total_num_classes=20,
        total=10_000,
        min_sample_rate=0.0,
    )
    floored_rates, floored_implicit = _run(
        transactions_rebalancing_model,
        classes=classes,
        sample_rate=0.5,
        total_num_classes=20,
        total=10_000,
        min_sample_rate=1e-6,
    )

    assert {item.id: item.new_sample_rate for item in floored_rates} == {
        item.id: item.new_sample_rate for item in base_rates
    }
    assert floored_implicit == pytest.approx(base_implicit)


def test_min_sample_rate_out_of_range_is_invalid(transactions_rebalancing_model) -> None:
    with pytest.raises(InvalidModelInputError):
        _run(
            transactions_rebalancing_model,
            classes=[RebalancedItem(id="big", count=1000)],
            sample_rate=0.5,
            total_num_classes=10,
            total=10_000,
            min_sample_rate=1.5,
        )
