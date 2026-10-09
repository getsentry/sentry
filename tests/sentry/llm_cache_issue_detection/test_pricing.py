from __future__ import annotations

from typing import Any

import pytest

from sentry.llm_cache_issue_detection.detection import (
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    Classification,
    OutcomeReason,
)
from sentry.llm_cache_issue_detection.pricing import PricingGap, SavingsEstimate, estimate_savings
from sentry.relay.config.ai_model_costs import AIModelMetadataConfig

# Order-of-magnitude realistic: a cached input token is far cheaper than a fresh
# one, and writing the cache costs a premium over both.
INPUT_PRICE = 0.000003
CACHED_INPUT_PRICE = 0.0000003
CACHE_WRITE_PRICE = 0.00000375


def costs(
    *,
    input_price: float = INPUT_PRICE,
    cached_input_price: float = CACHED_INPUT_PRICE,
    cache_write_price: float = CACHE_WRITE_PRICE,
) -> dict[str, Any]:
    return {
        "inputPerToken": input_price,
        "outputPerToken": 0.000015,
        "outputReasoningPerToken": 0.000015,
        "inputCachedPerToken": cached_input_price,
        "inputCacheWritePerToken": cache_write_price,
    }


def config(models: dict[str, Any]) -> AIModelMetadataConfig:
    return {
        "version": 1,
        "models": {model: {"costs": prices} for model, prices in models.items()},
    }


def make_stats(
    *,
    model: str = "claude-sonnet-4",
    sum_input_tokens: float = 10_000_000,
    sum_cache_read_tokens: float = 0,
    sum_cache_creation_tokens: float = 0,
) -> CallSiteStats:
    return CallSiteStats(
        agent_label="Planner",
        agent_label_source=AgentLabelSource.AGENT_NAME,
        span_name="generate_content claude-sonnet-4",
        model=model,
        call_count=5_000,
        sampled_call_count=5_000,
        sum_input_tokens=sum_input_tokens,
        sum_cache_read_tokens=sum_cache_read_tokens,
        sum_cache_creation_tokens=sum_cache_creation_tokens,
        avg_input_tokens=2_000,
    )


def make_finding(outcome: CacheOutcome, stats: CallSiteStats) -> CacheFinding:
    return CacheFinding(
        classification=Classification(outcome, OutcomeReason.CACHE_ACTIVITY),
        stats=stats,
        anchor=None,
    )


PRICED = config({"claude-sonnet-4": costs()})

THRASHING = make_stats(
    sum_input_tokens=10_000_000,
    sum_cache_read_tokens=200_000,
    sum_cache_creation_tokens=8_000_000,
)


@pytest.mark.parametrize(
    "cache_write_price",
    [
        pytest.param(CACHE_WRITE_PRICE, id="with-a-write-price"),
        # Most models the feed prices carry none, and this formula never uses it.
        pytest.param(0, id="without-a-write-price"),
    ],
)
def test_prices_uncached_volume_at_the_difference_it_could_have_paid(
    cache_write_price: float,
) -> None:
    metadata = config({"claude-sonnet-4": costs(cache_write_price=cache_write_price)})
    stats = make_stats(sum_input_tokens=10_000_000)

    estimate = estimate_savings(make_finding(CacheOutcome.NOT_CACHING, stats), metadata)

    assert isinstance(estimate, SavingsEstimate)
    assert estimate.estimated_savings_usd == pytest.approx(
        10_000_000 * (INPUT_PRICE - CACHED_INPUT_PRICE)
    )
    assert estimate.price_per_input_token == INPUT_PRICE
    assert estimate.price_per_cached_input_token == CACHED_INPUT_PRICE
    assert estimate.price_per_cache_write_token == cache_write_price
    assert estimate.overpay_vs_no_cache_usd is None


def test_prices_thrash_as_writes_that_should_have_been_reads() -> None:
    estimate = estimate_savings(make_finding(CacheOutcome.THRASH, THRASHING), PRICED)

    assert isinstance(estimate, SavingsEstimate)
    assert estimate.estimated_savings_usd == pytest.approx(
        8_000_000 * (CACHE_WRITE_PRICE - CACHED_INPUT_PRICE)
    )
    # The few reads recoup little of the write premium: worse than not caching.
    assert estimate.overpay_vs_no_cache_usd == pytest.approx(
        8_000_000 * (CACHE_WRITE_PRICE - INPUT_PRICE) - 200_000 * (INPUT_PRICE - CACHED_INPUT_PRICE)
    )


def test_omits_the_overpay_figure_when_the_reads_cover_the_premium() -> None:
    stats = make_stats(
        sum_input_tokens=10_000_000,
        sum_cache_read_tokens=6_000_000,
        sum_cache_creation_tokens=1_000_000,
    )

    estimate = estimate_savings(make_finding(CacheOutcome.THRASH, stats), PRICED)

    assert isinstance(estimate, SavingsEstimate)
    assert estimate.overpay_vs_no_cache_usd is None


@pytest.mark.parametrize(
    ("outcome", "stats", "metadata", "gap"),
    [
        pytest.param(
            CacheOutcome.NOT_CACHING, make_stats(), None, PricingGap.NO_METADATA, id="no-metadata"
        ),
        pytest.param(
            CacheOutcome.NOT_CACHING,
            make_stats(model="x"),
            PRICED,
            PricingGap.UNKNOWN_MODEL,
            id="unknown-model",
        ),
        # The feed's zero means "no price", not "free".
        pytest.param(
            CacheOutcome.NOT_CACHING,
            make_stats(),
            config({"claude-sonnet-4": costs(input_price=0)}),
            PricingGap.NO_INPUT_PRICE,
            id="no-input-price",
        ),
        pytest.param(
            CacheOutcome.NOT_CACHING,
            make_stats(),
            config({"claude-sonnet-4": costs(cached_input_price=0)}),
            PricingGap.NO_CACHED_PRICE,
            id="no-cached-price",
        ),
        pytest.param(
            CacheOutcome.THRASH,
            THRASHING,
            config({"claude-sonnet-4": costs(cache_write_price=0)}),
            PricingGap.NO_WRITE_PREMIUM,
            id="thrash-without-write-price",
        ),
        pytest.param(
            CacheOutcome.THRASH,
            THRASHING,
            config({"claude-sonnet-4": costs(cache_write_price=CACHED_INPUT_PRICE)}),
            PricingGap.NO_WRITE_PREMIUM,
            id="thrash-write-price-not-above-cached",
        ),
        # Input reported exclusive of cached tokens leaves nothing uncached.
        pytest.param(
            CacheOutcome.NOT_CACHING,
            make_stats(
                sum_input_tokens=1_000_000,
                sum_cache_read_tokens=900_000,
                sum_cache_creation_tokens=900_000,
            ),
            PRICED,
            PricingGap.NOTHING_TO_RECOVER,
            id="nothing-to-recover",
        ),
    ],
)
def test_names_why_a_finding_cannot_be_priced(
    outcome: CacheOutcome,
    stats: CallSiteStats,
    metadata: AIModelMetadataConfig | None,
    gap: PricingGap,
) -> None:
    assert estimate_savings(make_finding(outcome, stats), metadata) == gap
