import pytest
import responses

from sentry.relay.config.ai_model_costs import AI_MODEL_COSTS_CACHE_KEY, AIModelCosts
from sentry.tasks.ai_agent_monitoring import (
    MODELS_DEV_API_URL,
    OPENROUTER_MODELS_API_URL,
    fetch_ai_model_costs,
)
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


def _get_ai_model_costs_from_cache() -> AIModelCosts | None:
    """
    Utility function to retrieve AI model costs from cache.
    """
    return cache.get(AI_MODEL_COSTS_CACHE_KEY)


MOCK_OPENROUTER_API_RESPONSE = {
    "data": [
        {
            "id": "openai/gpt-4",
            "canonical_slug": "openai/gpt-4",
            "hugging_face_id": "",
            "name": "OpenAI: GPT-4",
            "created": 1750200414,
            "description": "Test description",
            "context_length": 1000000,
            "architecture": {
                "modality": "text",
                "input_modalities": ["text"],
                "output_modalities": ["text"],
                "tokenizer": "Other",
                "instruct_type": None,
            },
            "pricing": {
                "prompt": "0.0000003",
                "completion": "0.00000165",
                "request": "0",
                "image": "0",
                "web_search": "0",
                "internal_reasoning": "0",
            },
            "top_provider": {
                "context_length": 1000000,
                "max_completion_tokens": 40000,
                "is_moderated": False,
            },
            "per_request_limits": None,
            "supported_parameters": [
                "max_tokens",
                "temperature",
                "top_p",
                "reasoning",
                "include_reasoning",
            ],
        },
        {
            "id": "openai/gpt-5",
            "canonical_slug": "openai/gpt-4",
            "hugging_face_id": "",
            "name": "MiniMax: MiniMax M1 (extended)",
            "created": 1750200414,
            "description": 'MiniMax-M1 is a large-scale, open-weight reasoning model designed for extended context and high-efficiency inference. It leverages a hybrid Mixture-of-Experts (MoE) architecture paired with a custom "lightning attention" mechanism, allowing it to process long sequences—up to 1 million tokens—while maintaining competitive FLOP efficiency. With 456 billion total parameters and 45.9B active per token, this variant is optimized for complex, multi-step reasoning tasks.\n\nTrained via a custom reinforcement learning pipeline (CISPO), M1 excels in long-context understanding, software engineering, agentic tool use, and mathematical reasoning. Benchmarks show strong performance across FullStackBench, SWE-bench, MATH, GPQA, and TAU-Bench, often outperforming other open models like DeepSeek R1 and Qwen3-235B.',
            "context_length": 128000,
            "architecture": {
                "modality": "text-\u003etext",
                "input_modalities": ["text"],
                "output_modalities": ["text"],
                "tokenizer": "Other",
                "instruct_type": None,
            },
            "pricing": {
                "prompt": "0.00000055",
                "completion": "0.0000022",
                "request": "0.0001",
                "image": "0.0002",
                "web_search": "0.0003",
                "internal_reasoning": "0.00000055",
                "input_cache_read": "0.00000055",
            },
            "top_provider": {
                "context_length": 128000,
                "max_completion_tokens": 40000,
                "is_moderated": False,
            },
            "per_request_limits": None,
            "supported_parameters": [
                "tools",
                "tool_choice",
                "max_tokens",
                "temperature",
                "top_p",
                "reasoning",
                "include_reasoning",
                "structured_outputs",
                "stop",
                "frequency_penalty",
                "presence_penalty",
                "seed",
                "top_k",
                "min_p",
                "repetition_penalty",
                "logit_bias",
            ],
        },
    ]
}

MOCK_MODELS_DEV_API_RESPONSE = {
    "openai": {
        "models": {
            "gpt-4.1-mini": {
                "cost": {
                    "input": 0.4,
                    "output": 1.6,
                    "cache_read": 0.1,
                }
            },
            "gpt-4": {  # This should be skipped since it exists in OpenRouter
                "cost": {
                    "input": 0.1,  # Different from OpenRouter price
                    "output": 0.2,
                    "cache_read": 0.05,
                }
            },
        }
    },
    "google": {
        "models": {
            "gemini-2.5-pro": {
                "cost": {
                    "input": 1.25,
                    "output": 10,
                    "cache_read": 0.31,
                }
            },
        }
    },
    "invalid_provider": "this should be ignored",
}


class FetchAIModelCostsTest(TestCase):
    def setUp(self):
        super().setUp()
        # Clear cache before each test
        cache.delete(AI_MODEL_COSTS_CACHE_KEY)

    def _mock_openrouter_api_response(self, mock_response: dict):
        responses.add(
            responses.GET,
            OPENROUTER_MODELS_API_URL,
            json=mock_response,
            status=200,
        )

    def _mock_models_dev_api_response(self, mock_response: dict):
        responses.add(
            responses.GET,
            MODELS_DEV_API_URL,
            json=mock_response,
            status=200,
        )

    @responses.activate
    def test_fetch_ai_model_costs_success_both_apis(self):
        """Test successful fetching and caching from both APIs"""
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)
        self._mock_models_dev_api_response(MOCK_MODELS_DEV_API_RESPONSE)

        fetch_ai_model_costs()

        # Verify the data was cached correctly
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        assert cached_data.get("version") == 2
        assert cached_data.get("costs") is None
        assert cached_data.get("models") is not None

        models = cached_data.get("models")
        assert models is not None
        # Should have OpenRouter models + unique models.dev models
        assert (
            len(models) == 4
        )  # gpt-4, gpt-5 from OpenRouter + gpt-4.1-mini, gemini-2.5-pro from models.dev

        # Check OpenRouter models
        gpt4_model = models["gpt-4"]
        assert gpt4_model.get("inputPerToken") == 0.0000003  # OpenRouter price, not models.dev
        assert gpt4_model.get("outputPerToken") == 0.00000165
        assert gpt4_model.get("outputReasoningPerToken") == 0.0
        assert gpt4_model.get("inputCachedPerToken") == 0.0

        gpt5_model = models["gpt-5"]
        assert gpt5_model.get("inputPerToken") == 0.00000055
        assert gpt5_model.get("outputPerToken") == 0.0000022
        assert gpt5_model.get("outputReasoningPerToken") == 0.00000055
        assert gpt5_model.get("inputCachedPerToken") == 0.00000055

        # Check models.dev models
        gpt41_mini_model = models["gpt-4.1-mini"]
        assert gpt41_mini_model.get("inputPerToken") == 0.4
        assert gpt41_mini_model.get("outputPerToken") == 1.6
        assert (
            gpt41_mini_model.get("outputReasoningPerToken") == 0.0
        )  # models.dev doesn't provide this
        assert gpt41_mini_model.get("inputCachedPerToken") == 0.1

        gemini_model = models["gemini-2.5-pro"]
        assert gemini_model.get("inputPerToken") == 1.25
        assert gemini_model.get("outputPerToken") == 10
        assert gemini_model.get("outputReasoningPerToken") == 0.0
        assert gemini_model.get("inputCachedPerToken") == 0.31

    @responses.activate
    def test_fetch_ai_model_costs_success_openrouter_only(self):
        """Test successful fetching when only OpenRouter succeeds"""
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)
        # Also mock models.dev to return empty response to avoid real network call
        self._mock_models_dev_api_response({})

        fetch_ai_model_costs()

        # Verify the data was cached correctly
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        assert cached_data.get("version") == 2
        assert cached_data.get("costs") is None
        assert cached_data.get("models") is not None

        models = cached_data.get("models")
        assert models is not None
        assert len(models) == 2

        # Check first model with only input and output pricing
        gpt4_model = models["gpt-4"]
        assert gpt4_model.get("inputPerToken") == 0.0000003
        assert gpt4_model.get("outputPerToken") == 0.00000165
        assert gpt4_model.get("outputReasoningPerToken") == 0.0
        assert gpt4_model.get("inputCachedPerToken") == 0.0

        # Check second model with all pricing fields
        gpt5_model = models["gpt-5"]
        assert gpt5_model.get("inputPerToken") == 0.00000055
        assert gpt5_model.get("outputPerToken") == 0.0000022
        assert gpt5_model.get("outputReasoningPerToken") == 0.00000055
        assert gpt5_model.get("inputCachedPerToken") == 0.00000055

    @responses.activate
    def test_fetch_ai_model_costs_missing_pricing(self):
        """Test handling of models with missing pricing data"""
        mock_openrouter_response = {
            "data": [
                {
                    "id": "openai/gpt-4",
                    "pricing": {
                        "prompt": "0.03",
                        "completion": "0.06",
                    },
                },
                {
                    "id": "no-pricing-model",
                    # Missing pricing field
                },
                {
                    "id": "another-model",
                    "pricing": {
                        "prompt": "invalid",  # Invalid price format
                        "completion": "0.02",
                    },
                },
            ]
        }

        mock_models_dev_response = {
            "provider": {
                "models": {
                    "model-with-pricing": {
                        "cost": {
                            "input": 0.1,
                            "output": 0.2,
                        }
                    },
                    "model-no-cost": {
                        # Missing cost field
                    },
                }
            }
        }

        self._mock_openrouter_api_response(mock_openrouter_response)
        self._mock_models_dev_api_response(mock_models_dev_response)

        fetch_ai_model_costs()

        # Verify only valid models are cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        models = cached_data.get("models")
        assert models is not None
        assert len(models) == 4  # 3 from OpenRouter + 1 valid from models.dev

        # Check valid model
        gpt4_model = models["gpt-4"]
        assert gpt4_model.get("inputPerToken") == 0.03
        assert gpt4_model.get("outputPerToken") == 0.06
        assert gpt4_model.get("outputReasoningPerToken") == 0.0  # Missing should default to 0.0
        assert gpt4_model.get("inputCachedPerToken") == 0.0

        # Check model with invalid pricing (should default to 0.0)
        another_model = models["another-model"]
        assert another_model.get("inputPerToken") == 0.0  # Invalid "invalid" -> 0.0
        assert another_model.get("outputPerToken") == 0.02

        # Check model with no pricing (should default to 0.0)
        no_pricing_model = models["no-pricing-model"]
        assert no_pricing_model.get("inputPerToken") == 0.0
        assert no_pricing_model.get("outputPerToken") == 0.0
        assert no_pricing_model.get("outputReasoningPerToken") == 0.0
        assert no_pricing_model.get("inputCachedPerToken") == 0.0

        # Check models.dev model
        models_dev_model = models["model-with-pricing"]
        assert models_dev_model.get("inputPerToken") == 0.1
        assert models_dev_model.get("outputPerToken") == 0.2
        assert models_dev_model.get("outputReasoningPerToken") == 0.0
        assert models_dev_model.get("inputCachedPerToken") == 0.0

    @responses.activate
    def test_fetch_ai_model_costs_openrouter_invalid_response(self):
        """Test handling of invalid OpenRouter API response format"""
        # Invalid response - missing 'data' field
        mock_response = {"invalid": "response"}

        self._mock_openrouter_api_response(mock_response)

        with pytest.raises(ValueError, match="Invalid OpenRouter response format"):
            fetch_ai_model_costs()

        # Verify nothing was cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @responses.activate
    def test_fetch_ai_model_costs_models_dev_invalid_response(self):
        """Test handling of invalid models.dev API response format"""
        # Valid OpenRouter response
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)

        # Invalid models.dev response - not a dict
        responses.add(
            responses.GET,
            MODELS_DEV_API_URL,
            json=["not", "a", "dict"],
            status=200,
        )

        with pytest.raises(ValueError, match="Invalid models.dev response format"):
            fetch_ai_model_costs()

        # Verify nothing was cached due to models.dev failure
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @responses.activate
    def test_fetch_ai_model_costs_openrouter_http_error(self):
        """Test handling of OpenRouter HTTP errors"""
        responses.add(
            responses.GET,
            OPENROUTER_MODELS_API_URL,
            status=500,
        )

        with pytest.raises(Exception):
            fetch_ai_model_costs()

        # Verify nothing was cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @responses.activate
    def test_fetch_ai_model_costs_models_dev_http_error(self):
        """Test handling of models.dev HTTP errors"""
        # Valid OpenRouter response
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)

        # models.dev API error
        responses.add(
            responses.GET,
            MODELS_DEV_API_URL,
            status=500,
        )

        with pytest.raises(Exception):
            fetch_ai_model_costs()

        # Verify nothing was cached due to models.dev failure
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @responses.activate
    def test_fetch_ai_model_costs_timeout(self):
        """Test handling of request timeout"""
        import requests

        responses.add(
            responses.GET,
            OPENROUTER_MODELS_API_URL,
            body=requests.exceptions.Timeout("Request timed out"),
        )

        with pytest.raises(requests.exceptions.Timeout):
            fetch_ai_model_costs()

        # Verify nothing was cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    def test_get_ai_model_costs_from_cache_empty(self):
        """Test retrieving from empty cache"""
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None
