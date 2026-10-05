"""Turns a prompt-cache finding into money, whenever the model's prices are known."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from sentry.llm_cache_issue_detection.detection import CacheFinding, CacheOutcome
from sentry.relay.config.ai_model_costs import AIModelMetadataConfig, model_costs


@dataclass(frozen=True)
class SavingsEstimate:
    """What a finding costs, with the prices it was derived from, since those
    move by the time anyone reads the number."""

    estimated_savings_usd: float
    price_per_input_token: float
    price_per_cached_input_token: float
    price_per_cache_write_token: float
    # Thrash only, when caching as configured costs more than not caching.
    overpay_vs_no_cache_usd: float | None


class PricingGap(StrEnum):
    """Why a finding could not be priced."""

    # Air-gapped installs, or a cold cache.
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
    # The feed's zero means "no price", not "free", so each formula requires the
    # prices it uses rather than inventing a number.
    if input_price <= 0:
        return PricingGap.NO_INPUT_PRICE
    if cached_input_price <= 0:
        return PricingGap.NO_CACHED_PRICE

    stats = finding.stats
    if finding.outcome == CacheOutcome.THRASH:
        # Thrash is the write premium; without one there is nothing to quantify.
        if cache_write_price <= cached_input_price:
            return PricingGap.NO_WRITE_PREMIUM
        # A stable prefix would have turned those writes into reads.
        savings = stats.sum_cache_creation_tokens * (cache_write_price - cached_input_price)
        write_premium = stats.sum_cache_creation_tokens * (cache_write_price - input_price)
        read_discount = stats.sum_cache_read_tokens * (input_price - cached_input_price)
        overpay = write_premium - read_discount
        overpay_vs_no_cache_usd = overpay if overpay > 0 else None
    else:
        # An upper bound: how much of each prompt is a shared prefix is unknown.
        savings = stats.uncached_tokens * (input_price - cached_input_price)
        overpay_vs_no_cache_usd = None

    if savings <= 0:
        return PricingGap.NOTHING_TO_RECOVER

    return SavingsEstimate(
        estimated_savings_usd=savings,
        price_per_input_token=input_price,
        price_per_cached_input_token=cached_input_price,
        price_per_cache_write_token=cache_write_price,
        overpay_vs_no_cache_usd=overpay_vs_no_cache_usd,
    )
