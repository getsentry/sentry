from __future__ import annotations

from typing import Any

import pytest

from sentry.llm_cache_detection.detection import (
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
)
from sentry.llm_cache_detection.pricing import ModelPricebook
from sentry.relay.config.ai_model_costs import AIModelMetadataConfig, model_costs

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
        "models": {model: {"costs": model_costs} for model, model_costs in models.items()},
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
    return CacheFinding(outcome=outcome, stats=stats, anchor=None)


class TestModelCostsLookup:
    def test_matches_the_model_id_as_reported(self) -> None:
        found = model_costs("claude-sonnet-4", config({"claude-sonnet-4": costs()}))

        assert found is not None
        assert found["inputPerToken"] == INPUT_PRICE

    def test_matches_after_stripping_a_date_suffix(self) -> None:
        # Providers ship dated snapshots of the same model; the metadata is keyed
        # by the undated name.
        found = model_costs("claude-sonnet-4-20250514", config({"claude-sonnet-4": costs()}))

        assert found is not None

    def test_matches_a_model_the_span_reports_namespaced(self) -> None:
        # Gateways like OpenRouter and Bedrock report the provider alongside the
        # model; the metadata is keyed by the model alone.
        found = model_costs("anthropic/claude-sonnet-4", config({"claude-sonnet-4": costs()}))

        assert found is not None

    def test_matches_a_namespaced_model_carrying_a_date_suffix(self) -> None:
        found = model_costs(
            "anthropic/claude-sonnet-4-20250514", config({"claude-sonnet-4": costs()})
        )

        assert found is not None

    def test_matches_the_bare_key_beside_a_wildcard_prefixed_one(self) -> None:
        # The feed registers a `*`-prefixed key for relay to glob-match against,
        # always alongside the bare key. Nothing here reads the starred one, so
        # this is the shape the fetcher really produces, not the starred key alone.
        found = model_costs(
            "claude-sonnet-4", config({"claude-sonnet-4": costs(), "*claude-sonnet-4": costs()})
        )

        assert found is not None

    def test_returns_none_for_an_unknown_model(self) -> None:
        assert model_costs("some-self-hosted-model", config({"claude-sonnet-4": costs()})) is None

    def test_returns_none_without_metadata(self) -> None:
        assert model_costs("claude-sonnet-4", None) is None


class TestSavingsEstimate:
    def test_prices_uncached_volume_at_the_difference_it_could_have_paid(self) -> None:
        stats = make_stats(sum_input_tokens=10_000_000)
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs()}))

        estimate = pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, stats))

        assert estimate is not None
        assert estimate.estimated_savings_usd == pytest.approx(
            10_000_000 * (INPUT_PRICE - CACHED_INPUT_PRICE)
        )
        assert estimate.price_per_input_token == INPUT_PRICE
        assert estimate.price_per_cached_input_token == CACHED_INPUT_PRICE
        assert estimate.price_per_cache_write_token == CACHE_WRITE_PRICE
        # Only thrash can cost more than not caching at all.
        assert estimate.overpay_vs_no_cache_usd is None

    def test_prices_thrash_as_writes_that_should_have_been_reads(self) -> None:
        stats = make_stats(
            sum_input_tokens=10_000_000,
            sum_cache_read_tokens=200_000,
            sum_cache_creation_tokens=8_000_000,
        )
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs()}))

        estimate = pricebook.estimate(make_finding(CacheOutcome.THRASH, stats))

        assert estimate is not None
        assert estimate.estimated_savings_usd == pytest.approx(
            8_000_000 * (CACHE_WRITE_PRICE - CACHED_INPUT_PRICE)
        )
        # Writes bill above the plain input rate, and the few reads recoup very
        # little of it, so caching here is worse than not caching.
        assert estimate.overpay_vs_no_cache_usd == pytest.approx(
            8_000_000 * (CACHE_WRITE_PRICE - INPUT_PRICE)
            - 200_000 * (INPUT_PRICE - CACHED_INPUT_PRICE)
        )

    def test_omits_the_overpay_figure_when_the_reads_cover_the_premium(self) -> None:
        # Enough reads to pay back the write premium: the call site still trips
        # the ratio thresholds, but "worse than no cache" would be false.
        stats = make_stats(
            sum_input_tokens=10_000_000,
            sum_cache_read_tokens=6_000_000,
            sum_cache_creation_tokens=1_000_000,
        )
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs()}))

        estimate = pricebook.estimate(make_finding(CacheOutcome.THRASH, stats))

        assert estimate is not None
        assert estimate.overpay_vs_no_cache_usd is None

    def test_declines_when_there_is_nothing_left_to_recover(self) -> None:
        # Providers that report input tokens exclusive of cached ones drive
        # uncached_tokens to zero rather than negative, leaving no volume to
        # price. A zero here would render as a measured amount rather than as
        # the absence of one, so no estimate is made at all.
        stats = make_stats(
            sum_input_tokens=1_000_000,
            sum_cache_read_tokens=900_000,
            sum_cache_creation_tokens=900_000,
        )
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs()}))

        assert pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, stats)) is None

    def test_returns_none_for_an_unpriced_model(self) -> None:
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs()}))

        assert (
            pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, make_stats(model="x")))
            is None
        )

    def test_returns_none_without_metadata(self) -> None:
        # Air-gapped installs and a cold cache both land here, so an absent
        # estimate has to be ordinary rather than an error.
        pricebook = ModelPricebook(None)

        assert pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, make_stats())) is None

    def test_returns_none_when_the_model_has_no_input_price(self) -> None:
        # A zero input price means the feed carries no pricing for this model at
        # all, not that the model is free.
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs(input_price=0)}))

        assert pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, make_stats())) is None

    def test_returns_none_when_the_cached_price_is_missing(self) -> None:
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs(cached_input_price=0)}))

        assert pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, make_stats())) is None

    def test_prices_an_uncached_finding_without_a_cache_write_price(self) -> None:
        # Most models the feed prices carry no cache-write price, and the
        # uncached formula never uses one -- refusing to price on its account
        # would leave the common case unpriced for no reason.
        stats = make_stats(sum_input_tokens=1_000_000)
        pricebook = ModelPricebook(config({"claude-sonnet-4": costs(cache_write_price=0)}))

        estimate = pricebook.estimate(make_finding(CacheOutcome.NOT_CACHING, stats))

        assert estimate is not None
        assert estimate.estimated_savings_usd == pytest.approx(
            1_000_000 * (INPUT_PRICE - CACHED_INPUT_PRICE)
        )

    @pytest.mark.parametrize(
        "write_price",
        [
            pytest.param(0, id="no-write-price"),
            pytest.param(CACHED_INPUT_PRICE, id="write-price-not-above-the-cached-rate"),
        ],
    )
    def test_leaves_thrash_unpriced_without_a_credible_write_price(
        self, write_price: float
    ) -> None:
        # Thrash *is* the write premium. Without a price for it there is nothing
        # to quantify, and pricing the uncached remainder instead would report a
        # small number for a call site whose input is mostly cache traffic.
        stats = make_stats(
            sum_input_tokens=10_000_000,
            sum_cache_read_tokens=200_000,
            sum_cache_creation_tokens=8_000_000,
        )
        pricebook = ModelPricebook(
            config({"claude-sonnet-4": costs(cache_write_price=write_price)})
        )

        assert pricebook.estimate(make_finding(CacheOutcome.THRASH, stats)) is None
