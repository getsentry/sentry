"""Estimate savings for LLM prompt-cache findings."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from sentry.ai_monitoring.issues.llm_cache_detection.detection import CacheFinding, CacheOutcome
from sentry.ai_monitoring.utils import model_costs
from sentry.relay.config.ai_model_costs import AIModelMetadataConfig


@dataclass(frozen=True)
class SavingsEstimate:
    """Estimated savings and the prices used to calculate them."""

    estimated_savings_usd: float
    price_per_input_token: float
    price_per_cached_input_token: float
    price_per_cache_write_token: float


class PricingGap(StrEnum):
    """Why a finding could not be priced."""

    NO_METADATA = "no_metadata"
    UNKNOWN_MODEL = "unknown_model"
    NO_INPUT_PRICE = "no_input_price"
    NO_CACHED_PRICE = "no_cached_price"
    NO_WRITE_PREMIUM = "no_write_premium"
    NOTHING_TO_RECOVER = "nothing_to_recover"


def estimate_savings(
    finding: CacheFinding, config: AIModelMetadataConfig | None
) -> SavingsEstimate | PricingGap:
    if config is None:
        return PricingGap.NO_METADATA
    costs = model_costs(finding.stats.model, config)
    if costs is None:
        return PricingGap.UNKNOWN_MODEL

    input_price = costs["inputPerToken"]
    cached_input_price = costs["inputCachedPerToken"]
    cache_write_price = costs["inputCacheWritePerToken"]
    # Zero means no known price in the metadata feed, not free usage.
    if input_price <= 0:
        return PricingGap.NO_INPUT_PRICE
    if cached_input_price <= 0:
        return PricingGap.NO_CACHED_PRICE

    stats = finding.stats
    if finding.outcome == CacheOutcome.THRASH:
        if cache_write_price <= cached_input_price:
            return PricingGap.NO_WRITE_PREMIUM
        # A stable prefix would turn cache writes into cache reads.
        savings = stats.sum_cache_creation_tokens * (cache_write_price - cached_input_price)
    else:
        # This is an upper bound because the shared prefix length is unknown.
        savings = stats.uncached_tokens * (input_price - cached_input_price)

    if savings <= 0:
        return PricingGap.NOTHING_TO_RECOVER

    return SavingsEstimate(
        estimated_savings_usd=savings,
        price_per_input_token=input_price,
        price_per_cached_input_token=cached_input_price,
        price_per_cache_write_token=cache_write_price,
    )
