import pytest

from sentry.relay.config.ai_model_costs import (
    AIModelCost,
    AIModelMetadataConfig,
    canonical_model_name,
    model_costs,
)

COSTS: AIModelCost = {
    "inputPerToken": 0.000003,
    "outputPerToken": 0.000015,
    "outputReasoningPerToken": 0.000015,
    "inputCachedPerToken": 0.0000003,
    "inputCacheWritePerToken": 0.00000375,
}

CONFIG: AIModelMetadataConfig = {
    "version": 1,
    "models": {"claude-sonnet-4": {"costs": COSTS}},
}


@pytest.mark.parametrize(
    "model_id",
    [
        "claude-sonnet-4",
        # Providers ship dated snapshots of the same model; the metadata is keyed
        # by the undated name.
        "claude-sonnet-4-20250514",
        # Gateways like OpenRouter and Bedrock report the provider alongside the
        # model; the metadata is keyed by the model alone.
        "anthropic/claude-sonnet-4",
        "anthropic/claude-sonnet-4-20250514",
    ],
)
def test_model_costs_finds_a_model_however_the_span_names_it(model_id: str) -> None:
    assert model_costs(model_id, CONFIG) == COSTS


def test_model_costs_returns_none_for_an_unknown_model() -> None:
    assert model_costs("some-self-hosted-model", CONFIG) is None


@pytest.mark.parametrize(
    ("model_id", "expected"),
    [
        ("claude-haiku-4-5", "claude-haiku-4-5"),
        pytest.param("claude-haiku-4-5-20251001", "claude-haiku-4-5", id="dated-snapshot"),
        pytest.param("anthropic/claude-haiku-4.5", "claude-haiku-4-5", id="openrouter"),
        pytest.param(
            "us.anthropic.claude-haiku-4-5-20251001-v1:0", "claude-haiku-4-5", id="bedrock"
        ),
        pytest.param("claude-haiku-4-5@20251001", "claude-haiku-4-5", id="vertex"),
        pytest.param("models/gemini-2.5-pro", "gemini-2-5-pro", id="gemini-namespace"),
        pytest.param("GPT-5.6", "gpt-5-6", id="case"),
    ],
)
def test_canonical_model_name(model_id: str, expected: str) -> None:
    assert canonical_model_name(model_id) == expected
