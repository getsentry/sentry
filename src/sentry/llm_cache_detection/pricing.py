"""Turns a prompt-cache finding into money.

Cache tokens are only interesting because they are billed differently: a cached
input token costs a fraction of a fresh one, and writing the cache costs a
premium over both. Findings are reported in tokens regardless, but a dollar
figure is what makes the waste legible, so it is attached whenever the model's
prices are known.
"""

from __future__ import annotations

from dataclasses import dataclass

from sentry.llm_cache_detection.detection import CacheFinding, CacheOutcome
from sentry.relay.config.ai_model_costs import (
    AIModelCost,
    AIModelMetadataConfig,
    ai_model_metadata_config,
    model_costs,
)


@dataclass(frozen=True)
class SavingsEstimate:
    """What a finding costs, and the prices it was derived from.

    The prices travel with the estimate so the issue can show its work: they are
    fetched hourly from an external source and will have moved by the time
    anyone reads the number.
    """

    estimated_savings_usd: float
    price_per_input_token: float
    price_per_cached_input_token: float
    price_per_cache_write_token: float
    # Thrash only, and only when positive: the amount by which caching as
    # currently configured costs *more* than not caching at all.
    overpay_vs_no_cache_usd: float | None


class ModelPricebook:
    """A run's snapshot of model prices.

    Loaded once per project rather than per finding: the metadata is a single
    cache entry covering every model, and a run must price all of its findings
    against the same one.
    """

    def __init__(self, config: AIModelMetadataConfig | None) -> None:
        self._config = config

    @classmethod
    def load(cls) -> ModelPricebook:
        return cls(ai_model_metadata_config())

    def estimate(self, finding: CacheFinding) -> SavingsEstimate | None:
        """Price a finding, or return None when the model's prices are unknown.

        Unknown is the normal case for air-gapped installs, self-hosted models
        and anything the metadata feed has not seen, so callers must treat a
        missing estimate as ordinary rather than exceptional.
        """
        costs = model_costs(finding.stats.model, self._config)
        if costs is None:
            return None
        return _estimate_from_costs(finding, costs)


def _estimate_from_costs(finding: CacheFinding, costs: AIModelCost) -> SavingsEstimate | None:
    input_price = costs["inputPerToken"]
    cached_input_price = costs["inputCachedPerToken"]
    cache_write_price = costs["inputCacheWritePerToken"]

    # A zero is the feed saying it has no price, not that the tokens are free:
    # most models it prices carry a zero cache-write price, including ones whose
    # provider demonstrably charges a premium to write. So each formula requires
    # the prices it actually uses, and declines rather than inventing a number.
    if input_price <= 0 or cached_input_price <= 0:
        return None

    stats = finding.stats

    if finding.outcome == CacheOutcome.THRASH:
        # The whole finding is that the prefix is written and then invalidated,
        # so without a write price there is nothing to quantify. Pricing the
        # uncached remainder instead would report a small number for a call site
        # whose input is mostly cache traffic.
        if cache_write_price <= cached_input_price:
            return None
        # A stable prefix would have turned those writes into reads.
        savings = stats.sum_cache_creation_tokens * (cache_write_price - cached_input_price)
        overpay = stats.sum_cache_creation_tokens * (
            cache_write_price - input_price
        ) - stats.sum_cache_read_tokens * (input_price - cached_input_price)
        overpay_vs_no_cache_usd = overpay if overpay > 0 else None
    else:
        # Nothing is cached, so the whole uncached volume was billed at the full
        # input rate. Deliberately never touches the write price, which providers
        # that cache implicitly do not report. An upper bound: how much of each
        # prompt is a shared prefix is not knowable from aggregates.
        savings = stats.uncached_tokens * (input_price - cached_input_price)
        overpay_vs_no_cache_usd = None

    # Nothing to recover is not a number worth showing: rendered, it reads as a
    # measured zero rather than as the absence of an estimate, and every surface
    # already has a way to say nothing.
    if savings <= 0:
        return None

    return SavingsEstimate(
        estimated_savings_usd=savings,
        price_per_input_token=input_price,
        price_per_cached_input_token=cached_input_price,
        price_per_cache_write_token=cache_write_price,
        overpay_vs_no_cache_usd=overpay_vs_no_cache_usd,
    )
