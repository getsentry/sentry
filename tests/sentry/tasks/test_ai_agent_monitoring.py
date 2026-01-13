import pytest
import responses

from sentry.relay.config.ai_model_costs import AI_MODEL_COSTS_CACHE_KEY, AIModelCosts
from sentry.tasks.ai_agent_monitoring import (
    MODELS_DEV_API_URL,
    OPENROUTER_MODELS_API_URL,
    fetch_ai_model_costs,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
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
                    "input": 0.4 * 1000000,  # models.dev have prices per 1M tokens
                    "output": 1.6 * 1000000,  # models.dev have prices per 1M tokens
                    "cache_read": 0.1 * 1000000,  # models.dev have prices per 1M tokens
                }
            },
            "gpt-4": {  # This should be skipped since it exists in OpenRouter
                "cost": {
                    "input": 0.1 * 1000000,  # models.dev have prices per 1M tokens
                    "output": 0.2 * 1000000,  # models.dev have prices per 1M tokens
                    "cache_read": 0.05 * 1000000,  # models.dev have prices per 1M tokens
                }
            },
        }
    },
    "google": {
        "models": {
            "gemini-2.5-pro": {
                "cost": {
                    "input": 1.25 * 1000000,  # models.dev have prices per 1M tokens
                    "output": 10 * 1000000,  # models.dev have prices per 1M tokens
                    "cache_read": 0.31 * 1000000,  # models.dev have prices per 1M tokens
                }
            },
            "google/gemini-2.0-flash-001": {  # Test provider prefix stripping
                "cost": {
                    "input": 0.075 * 1000000,  # models.dev have prices per 1M tokens
                    "output": 0.3 * 1000000,  # models.dev have prices per 1M tokens
                    "cache_read": 0.01875 * 1000000,  # models.dev have prices per 1M tokens
                }
            },
        }
    },
    "invalid_provider": "this should be ignored",
}


class FetchAIModelCostsTest(TestCase):
    def setUp(self) -> None:
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
    def test_fetch_ai_model_costs_success_both_apis(self) -> None:
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

        # Check models.dev model with provider prefix (should be stripped)
        gemini_flash_model = models["gemini-2.0-flash-001"]
        assert gemini_flash_model.get("inputPerToken") == 0.075
        assert gemini_flash_model.get("outputPerToken") == 0.3
        assert gemini_flash_model.get("outputReasoningPerToken") == 0.0
        assert gemini_flash_model.get("inputCachedPerToken") == 0.01875

    @responses.activate
    def test_fetch_ai_model_costs_success_openrouter_only(self) -> None:
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
    def test_fetch_ai_model_costs_missing_pricing(self) -> None:
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
                            "input": 0.1 * 1000000,  # models.dev have prices per 1M tokens
                            "output": 0.2 * 1000000,  # models.dev have prices per 1M tokens
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
    def test_fetch_ai_model_costs_openrouter_invalid_response(self) -> None:
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
    def test_fetch_ai_model_costs_models_dev_invalid_response(self) -> None:
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
    def test_fetch_ai_model_costs_openrouter_http_error(self) -> None:
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
    def test_fetch_ai_model_costs_models_dev_http_error(self) -> None:
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
    def test_fetch_ai_model_costs_timeout(self) -> None:
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

    def test_get_ai_model_costs_from_cache_empty(self) -> None:
        """Test retrieving from empty cache"""
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @override_options(
        {
            "ai-agent-monitoring.custom-model-mapping": [
                {
                    "alternative_model_id": "gemini-pro-alternative",
                    "existing_model_id": "gemini-2.5-pro",
                },
                {
                    "alternative_model_id": "nonexistent-mapping",
                    "existing_model_id": "model-that-does-not-exist",
                },
            ]
        }
    )
    @responses.activate
    def test_fetch_ai_model_costs_custom_model_mapping(self) -> None:
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)
        self._mock_models_dev_api_response(MOCK_MODELS_DEV_API_RESPONSE)

        fetch_ai_model_costs()

        # Verify the data was cached correctly
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        models = cached_data.get("models")
        assert models is not None

        # Original models should exist
        assert "gemini-2.5-pro" in models

        # Alternative model IDs should be mapped to existing models
        assert "gemini-pro-alternative" in models

        # Verify that the alternative models have the same pricing as the existing models
        gemini_model = models["gemini-2.5-pro"]
        gemini_alt_model = models["gemini-pro-alternative"]
        assert gemini_model.get("inputPerToken") == gemini_alt_model.get("inputPerToken")
        assert gemini_model.get("outputPerToken") == gemini_alt_model.get("outputPerToken")
        assert gemini_model.get("outputReasoningPerToken") == gemini_alt_model.get(
            "outputReasoningPerToken"
        )
        assert gemini_model.get("inputCachedPerToken") == gemini_alt_model.get(
            "inputCachedPerToken"
        )

        # Non-existent mapping should not create a new model
        assert "nonexistent-mapping" not in models

    @responses.activate
    def test_fetch_ai_model_costs_with_hardcoded_embedding_models(self) -> None:
        """Test that hardcoded embedding models are added (BAAI/bge-m3, jina-embeddings)"""
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)
        self._mock_models_dev_api_response(MOCK_MODELS_DEV_API_RESPONSE)

        fetch_ai_model_costs()

        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        models = cached_data.get("models")
        assert models is not None

        # Verify BAAI/bge-m3 is in the models dict
        assert "BAAI/bge-m3" in models
        baai_model = models["BAAI/bge-m3"]
        assert baai_model.get("inputPerToken") == 0.0
        assert baai_model.get("outputPerToken") == 0.0
        assert baai_model.get("outputReasoningPerToken") == 0.0
        assert baai_model.get("inputCachedPerToken") == 0.0

        # Verify jinaai/jina-embeddings-v2-base-en is in the models dict
        assert "jinaai/jina-embeddings-v2-base-en" in models
        jina_model = models["jinaai/jina-embeddings-v2-base-en"]
        assert jina_model.get("inputPerToken") == 0.0
        assert jina_model.get("outputPerToken") == 0.0
        assert jina_model.get("outputReasoningPerToken") == 0.0
        assert jina_model.get("inputCachedPerToken") == 0.0

    @responses.activate
    def test_fetch_ai_model_costs_with_normalized_and_prefix_glob_names(self) -> None:
        """Test that normalized and prefix glob versions of model names are added correctly"""
        # Mock responses with models that have dates/versions that should be normalized
        mock_openrouter_response = {
            "data": [
                {
                    "id": "openai/gpt-4o-mini-20250522",
                    "pricing": {
                        "prompt": "0.0000003",
                        "completion": "0.00000165",
                    },
                },
                {
                    "id": "openai/claude-3-5-sonnet-20241022",
                    "pricing": {
                        "prompt": "0.00000015",
                        "completion": "0.00000075",
                    },
                },
                {
                    "id": "openai/gpt-4",  # No date/version, normalized version same as original
                    "pricing": {
                        "prompt": "0.0000003",
                        "completion": "0.00000165",
                    },
                },
            ]
        }

        mock_models_dev_response = {
            "anthropic": {
                "models": {
                    "claude-3-5-haiku@20241022": {
                        "cost": {
                            "input": 0.25 * 1000000,
                            "output": 1.25 * 1000000,
                        }
                    },
                    "o3-pro-2025-06-10": {
                        "cost": {
                            "input": 0.5 * 1000000,
                            "output": 2.5 * 1000000,
                        }
                    },
                }
            }
        }

        self._mock_openrouter_api_response(mock_openrouter_response)
        self._mock_models_dev_api_response(mock_models_dev_response)

        fetch_ai_model_costs()

        # Verify the data was cached correctly
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        models = cached_data.get("models")
        assert models is not None

        # Check original models exist
        assert "gpt-4o-mini-20250522" in models
        assert "claude-3-5-sonnet-20241022" in models
        assert "gpt-4" in models
        assert "claude-3-5-haiku@20241022" in models
        assert "o3-pro-2025-06-10" in models

        # Check normalized versions were added (dates/versions removed)
        assert "gpt-4o-mini" in models
        assert "claude-3-5-sonnet" in models
        assert "claude-3-5-haiku" in models  # @ is not part of the date pattern
        assert "o3-pro" in models

        # Check prefix glob versions of normalized models were added
        assert "*gpt-4o-mini" in models
        assert "*claude-3-5-sonnet" in models
        assert "*gpt-4" in models
        assert "*claude-3-5-haiku" in models
        assert "*o3-pro" in models

        # Verify normalized versions have same pricing as original models
        gpt4o_mini_original = models["gpt-4o-mini-20250522"]
        gpt4o_mini_normalized = models["gpt-4o-mini"]
        assert gpt4o_mini_original.get("inputPerToken") == gpt4o_mini_normalized.get(
            "inputPerToken"
        )
        assert gpt4o_mini_original.get("outputPerToken") == gpt4o_mini_normalized.get(
            "outputPerToken"
        )

        claude_sonnet_original = models["claude-3-5-sonnet-20241022"]
        claude_sonnet_normalized = models["claude-3-5-sonnet"]
        assert claude_sonnet_original.get("inputPerToken") == claude_sonnet_normalized.get(
            "inputPerToken"
        )
        assert claude_sonnet_original.get("outputPerToken") == claude_sonnet_normalized.get(
            "outputPerToken"
        )

        claude_haiku_original = models["claude-3-5-haiku@20241022"]
        claude_haiku_normalized = models["claude-3-5-haiku"]
        assert claude_haiku_original.get("inputPerToken") == claude_haiku_normalized.get(
            "inputPerToken"
        )
        assert claude_haiku_original.get("outputPerToken") == claude_haiku_normalized.get(
            "outputPerToken"
        )

        o3_pro_original = models["o3-pro-2025-06-10"]
        o3_pro_normalized = models["o3-pro"]
        assert o3_pro_original.get("inputPerToken") == o3_pro_normalized.get("inputPerToken")
        assert o3_pro_original.get("outputPerToken") == o3_pro_normalized.get("outputPerToken")

        # Verify prefix glob versions have same pricing as normalized models
        gpt4_normalized = models["gpt-4"]
        gpt4_prefix_glob = models["*gpt-4"]
        assert gpt4_normalized.get("inputPerToken") == gpt4_prefix_glob.get("inputPerToken")
        assert gpt4_normalized.get("outputPerToken") == gpt4_prefix_glob.get("outputPerToken")

        gpt4o_mini_prefix_glob = models["*gpt-4o-mini"]
        assert gpt4o_mini_normalized.get("inputPerToken") == gpt4o_mini_prefix_glob.get(
            "inputPerToken"
        )
        assert gpt4o_mini_normalized.get("outputPerToken") == gpt4o_mini_prefix_glob.get(
            "outputPerToken"
        )

    def test_normalize_model_id(self) -> None:
        """Test model ID normalization with various date and version formats"""
        from sentry.tasks.ai_agent_monitoring import _normalize_model_id

        # Test cases with expected outputs
        test_cases = [
            ("model-20250522", "model"),  # YYYYMMDD removed
            ("model-2025-06-10", "model"),  # YYYY-MM-DD removed
            ("model-2025/06/10", "model"),  # YYYY/MM/DD removed
            ("model-2025.06.10", "model"),  # YYYY.MM.DD removed
            ("model-v1.0", "model"),  # v1.0 removed
            ("model@20241022", "model"),  # @YYYYMMDD removed
            ("model-v1:0", "model"),  # v1:0 removed
            ("model-20250610-v1:0", "model"),  # YYYYMMDD-v1:0 removed
            ("model@20250610-v1:0", "model"),  # @YYYYMMDD-v1:0 removed
            ("gpt-4", "gpt-4"),  # No date/version, unchanged
            ("claude-3-5-sonnet", "claude-3-5-sonnet"),  # Numbers are part of model name, unchanged
        ]

        for model_id, expected_normalized in test_cases:
            actual_normalized = _normalize_model_id(model_id)
            assert (
                actual_normalized == expected_normalized
            ), f"Expected {expected_normalized} for {model_id}, got {actual_normalized}"

    def test_create_prefix_glob_model_name(self) -> None:
        """Test prefix glob generation for model names"""
        from sentry.tasks.ai_agent_monitoring import _create_prefix_glob_model_name

        # Test cases with expected outputs
        test_cases = [
            ("gpt-4", "*gpt-4"),
            ("gpt-4o-mini", "*gpt-4o-mini"),
            ("claude-3-5-sonnet", "*claude-3-5-sonnet"),
            ("", "*"),
        ]

        for model_id, expected_glob in test_cases:
            actual_glob = _create_prefix_glob_model_name(model_id)
            assert (
                actual_glob == expected_glob
            ), f"Expected {expected_glob} for {model_id}, got {actual_glob}"
