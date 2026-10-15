from __future__ import annotations

from dataclasses import replace

import pytest

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CacheFinding,
    CacheOutcome,
    Classification,
    OutcomeReason,
)
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import (
    PricingGap,
    SavingsEstimate,
    estimate_savings,
)
from sentry.relay.config.ai_model_costs import AIModelCost, AIModelMetadataConfig
from tests.sentry.ai_monitoring.issues.llm_cache_detection.test_utils import make_stats

INPUT_PRICE = 0.000003
CACHED_PRICE = 0.0000003
WRITE_PRICE = 0.00000375
MODEL = "claude-sonnet-4"


def metadata(
    *,
    input_price: float = INPUT_PRICE,
    cached_price: float = CACHED_PRICE,
    write_price: float = WRITE_PRICE,
) -> AIModelMetadataConfig:
    costs: AIModelCost = {
        "inputPerToken": input_price,
        "outputPerToken": 0.000015,
        "outputReasoningPerToken": 0.000015,
        "inputCachedPerToken": cached_price,
        "inputCacheWritePerToken": write_price,
    }
    return {"version": 1, "models": {MODEL: {"costs": costs}}}


def finding(
    outcome: CacheOutcome,
    *,
    model: str = MODEL,
    read_tokens: float = 0,
    write_tokens: float = 0,
) -> CacheFinding:
    stats = replace(
        make_stats(model=model),
        sum_input_tokens=10_000_000,
        sum_cache_read_tokens=read_tokens,
        sum_cache_creation_tokens=write_tokens,
    )
    return CacheFinding(
        classification=Classification(outcome, OutcomeReason.CACHE_ACTIVITY),
        stats=stats,
    )


@pytest.mark.parametrize(
    ("cache_finding", "expected"),
    [
        (
            finding(CacheOutcome.NOT_CACHING),
            10_000_000 * (INPUT_PRICE - CACHED_PRICE),
        ),
        (
            finding(CacheOutcome.THRASH, read_tokens=200_000, write_tokens=8_000_000),
            8_000_000 * (WRITE_PRICE - CACHED_PRICE),
        ),
    ],
)
def test_estimates_savings(cache_finding: CacheFinding, expected: float) -> None:
    estimate = estimate_savings(cache_finding, metadata())

    assert isinstance(estimate, SavingsEstimate)
    assert estimate.estimated_savings_usd == pytest.approx(expected)
    assert estimate.price_per_input_token == INPUT_PRICE
    assert estimate.price_per_cached_input_token == CACHED_PRICE
    assert estimate.price_per_cache_write_token == WRITE_PRICE


@pytest.mark.parametrize(
    ("cache_finding", "config", "expected"),
    [
        (finding(CacheOutcome.NOT_CACHING), None, PricingGap.NO_METADATA),
        (finding(CacheOutcome.NOT_CACHING, model="unknown"), metadata(), PricingGap.UNKNOWN_MODEL),
        (
            finding(CacheOutcome.NOT_CACHING),
            metadata(input_price=0),
            PricingGap.NO_INPUT_PRICE,
        ),
        (
            finding(CacheOutcome.NOT_CACHING),
            metadata(cached_price=0),
            PricingGap.NO_CACHED_PRICE,
        ),
        (
            finding(CacheOutcome.THRASH, write_tokens=8_000_000),
            metadata(write_price=0),
            PricingGap.NO_WRITE_PREMIUM,
        ),
        (
            finding(CacheOutcome.NOT_CACHING),
            metadata(cached_price=INPUT_PRICE),
            PricingGap.NOTHING_TO_RECOVER,
        ),
    ],
)
def test_reports_pricing_gaps(
    cache_finding: CacheFinding,
    config: AIModelMetadataConfig | None,
    expected: PricingGap,
) -> None:
    assert estimate_savings(cache_finding, config) == expected
