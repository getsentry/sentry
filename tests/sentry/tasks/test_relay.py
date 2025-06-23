import contextlib
from unittest import mock
from unittest.mock import call, patch

import pytest
import responses
from django.db import router, transaction

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.models.options.project_option import ProjectOption
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.relay.config.ai_model_costs import AI_MODEL_COSTS_CACHE_KEY, AIModelCosts
from sentry.relay.projectconfig_cache.redis import RedisProjectConfigCache
from sentry.relay.projectconfig_debounce_cache.redis import RedisProjectConfigDebounceCache
from sentry.tasks.relay import (
    OPENROUTER_MODELS_API_URL,
    _schedule_invalidate_project_config,
    build_project_config,
    fetch_ai_model_costs,
    invalidate_project_config,
    schedule_build_project_config,
    schedule_invalidate_project_config,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.hybrid_cloud import simulated_transaction_watermarks
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.cache import cache


def _cache_keys_for_project(project):
    for key in ProjectKey.objects.filter(project_id=project.id):
        yield key.public_key


@pytest.fixture(autouse=True)
def disable_auto_on_commit():
    simulated_transaction_watermarks.state["default"] = -1
    with in_test_hide_transaction_boundary():
        yield


@pytest.fixture
def emulate_transactions(django_capture_on_commit_callbacks):
    # This contraption helps in testing the usage of `transaction.on_commit` in
    # schedule_build_project_config. Normally tests involving transactions would
    # require us to use the transactional testcase (or
    # `pytest.mark.django_db(transaction=True)`), but that incurs a 2x slowdown
    # in test speed and we're trying to keep our testcases fast.
    @contextlib.contextmanager
    def inner(assert_num_callbacks=1):
        with BurstTaskRunner() as burst:
            with django_capture_on_commit_callbacks(execute=True) as callbacks:
                yield

                # Assert there are no relay-related jobs in the queue yet, as we should have
                # some on_commit callbacks instead. If we don't, then the model
                # hook has scheduled the build_project_config task prematurely.
                #
                # Remove any other jobs from the queue that may have been triggered via model hooks
                assert not any("relay" in task.__name__ for task, _, _ in burst.queue)
                burst.queue.clear()

            # for some reason, the callbacks array is only populated by
            # pytest-django's implementation after the context manager has
            # exited, not while they are being registered
            assert len(callbacks) == assert_num_callbacks

            # Callbacks have been executed, job(s) should've been scheduled now, so
            # let's execute them.
            #
            # Note: We can't directly assert that the data race has not occured, as
            # there are no real DB transactions available in this testcase. The
            # entire test runs in one transaction because that's how pytest-django
            # sets up things unless one uses
            # pytest.mark.django_db(transaction=True).
            burst(max_jobs=20)

    return inner


@pytest.fixture
def redis_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_CACHE",
        "sentry.relay.projectconfig_cache.redis.RedisProjectConfigCache",
    )

    cache = RedisProjectConfigCache()
    monkeypatch.setattr("sentry.relay.projectconfig_cache.set_many", cache.set_many)
    monkeypatch.setattr("sentry.relay.projectconfig_cache.delete_many", cache.delete_many)
    monkeypatch.setattr("sentry.relay.projectconfig_cache.get", cache.get)

    return cache


@pytest.fixture
def debounce_cache(monkeypatch):
    monkeypatch.setattr(
        "django.conf.settings.SENTRY_RELAY_PROJECTCONFIG_DEBOUNCE_CACHE",
        "sentry.relay.projectconfig_debounce_cache.redis.RedisProjectConfigDebounceCache",
    )

    cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.mark_task_done", cache.mark_task_done
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.debounce", cache.debounce
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.backend.is_debounced", cache.is_debounced
    )

    return cache


@pytest.fixture
def invalidation_debounce_cache(monkeypatch):
    debounce_cache = RedisProjectConfigDebounceCache()
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.mark_task_done",
        debounce_cache.mark_task_done,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.debounce",
        debounce_cache.debounce,
    )
    monkeypatch.setattr(
        "sentry.relay.projectconfig_debounce_cache.invalidation.is_debounced",
        debounce_cache.is_debounced,
    )

    return debounce_cache


@django_db_all
def test_debounce(
    monkeypatch,
    default_projectkey,
    default_organization,
    debounce_cache,
    django_cache,
):
    tasks = []

    def apply_async(args, kwargs):
        assert not args
        tasks.append(kwargs)

    monkeypatch.setattr("sentry.tasks.relay.build_project_config.apply_async", apply_async)

    schedule_build_project_config(public_key=default_projectkey.public_key)
    schedule_build_project_config(public_key=default_projectkey.public_key)

    assert len(tasks) == 1
    assert tasks[0]["public_key"] == default_projectkey.public_key


@django_db_all
def test_generate(
    monkeypatch,
    default_project,
    default_organization,
    default_projectkey,
    redis_cache,
    django_cache,
):
    # redis_cache.delete_many([default_projectkey.public_key])
    assert not redis_cache.get(default_projectkey.public_key)

    build_project_config(default_projectkey.public_key)

    cfg = redis_cache.get(default_projectkey.public_key)

    assert cfg["organizationId"] == default_organization.id
    assert cfg["projectId"] == default_project.id
    assert cfg["publicKeys"] == [
        {
            "isEnabled": True,
            "publicKey": default_projectkey.public_key,
            "numericId": default_projectkey.id,
        }
    ]


@django_db_all
def test_project_update_option(
    default_projectkey,
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
        default_project.organization.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

    # They should be recalculated.  Note that oddly enough we actually get the same rule
    # twice.  once for the org and once for the project
    for cache_key in _cache_keys_for_project(default_project):
        cache = redis_cache.get(cache_key)
        assert cache["config"]["piiConfig"]["applications"] == {
            "$string": ["@creditcard:mask", "@creditcard:mask"]
        }


@django_db_all
def test_project_delete_option(
    default_projectkey,
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=1):
        default_project.delete_option("sentry:relay_pii_config")

    assert redis_cache.get(default_projectkey)["config"]["piiConfig"] == {}


@django_db_all
def test_project_get_option_does_not_reload(
    default_project,
    emulate_transactions,
    monkeypatch,
    django_cache,
):
    ProjectOption.objects._option_cache.clear()
    with emulate_transactions(assert_num_callbacks=0):
        with patch("sentry.utils.cache.cache.get", return_value=None):
            with patch("sentry.tasks.relay.schedule_build_project_config") as build_project_config:
                default_project.get_option(
                    "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
                )

    assert not build_project_config.called


@django_db_all
def test_invalidation_project_deleted(
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # Ensure we have a ProjectKey
    project_key = next(_cache_keys_for_project(default_project))
    assert project_key

    # Ensure we have a config in the cache.
    build_project_config(public_key=project_key)
    assert redis_cache.get(project_key)["disabled"] is False

    project_id = default_project.id

    # Delete the project normally, this will delete it from the cache
    with emulate_transactions(assert_num_callbacks=4):
        default_project.delete()
    assert redis_cache.get(project_key)["disabled"]

    # Duplicate invoke the invalidation task, this needs to be fine with the missing project.
    invalidate_project_config(project_id=project_id, trigger="testing-double-delete")
    assert redis_cache.get(project_key)["disabled"]


@django_db_all
def test_projectkeys(
    default_project,
    emulate_transactions,
    redis_cache,
    django_cache,
):
    # When a projectkey is deleted the invalidation task should be triggered and the project
    # should be cached as disabled.

    # XXX: there should only be one hook triggered, regardless of debouncing
    with emulate_transactions(assert_num_callbacks=2):
        deleted_pks = list(ProjectKey.objects.filter(project=default_project))
        for key in deleted_pks:
            key.delete()

        pk = ProjectKey(project=default_project)
        pk.save()

    for key in deleted_pks:
        assert redis_cache.get(key.public_key)["disabled"]

    (pk_json,) = redis_cache.get(pk.public_key)["publicKeys"]
    assert pk_json["publicKey"] == pk.public_key

    with emulate_transactions():
        pk.status = ProjectKeyStatus.INACTIVE
        pk.save()

    assert redis_cache.get(pk.public_key)["disabled"]

    with emulate_transactions():
        pk.delete()

    assert redis_cache.get(pk.public_key)["disabled"]

    for key in ProjectKey.objects.filter(project_id=default_project.id):
        assert not redis_cache.get(key.public_key)


@django_db_all(transaction=True)
def test_db_transaction(
    default_project,
    default_projectkey,
    redis_cache,
    task_runner,
    django_cache,
):
    # Put something in the cache, otherwise triggers/the invalidation task won't compute
    # anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    with task_runner(), transaction.atomic(router.db_for_write(ProjectOption)):
        default_project.update_option(
            "sentry:relay_pii_config", '{"applications": {"$string": ["@creditcard:mask"]}}'
        )

        # Assert that cache entry hasn't been created yet, only after the
        # transaction has committed.
        assert redis_cache.get(default_projectkey.public_key) == {"dummy": "dummy"}

    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }

    try:
        with task_runner(), transaction.atomic(router.db_for_write(ProjectOption)):
            default_project.update_option(
                "sentry:relay_pii_config", '{"applications": {"$string": ["@password:mask"]}}'
            )

            raise Exception("rollback!")

    except Exception:
        pass

    # Assert that database rollback is honored
    assert redis_cache.get(default_projectkey.public_key)["config"]["piiConfig"] == {
        "applications": {"$string": ["@creditcard:mask"]}
    }


@django_db_all(transaction=True)
class TestInvalidationTask:
    def test_debounce(
        self,
        monkeypatch,
        default_project,
        default_organization,
        invalidation_debounce_cache,
        django_cache,
    ):
        tasks = []

        def apply_async(args=None, kwargs=None, countdown=None):
            assert not args
            tasks.append(kwargs)

        monkeypatch.setattr("sentry.tasks.relay.invalidate_project_config.apply_async", apply_async)

        invalidation_debounce_cache.mark_task_done(
            public_key=None, project_id=default_project.id, organization_id=None
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")

        invalidation_debounce_cache.mark_task_done(
            public_key=None, project_id=None, organization_id=default_organization.id
        )
        schedule_invalidate_project_config(organization_id=default_organization.id, trigger="test")
        schedule_invalidate_project_config(organization_id=default_organization.id, trigger="test")

        assert tasks == [
            {
                "project_id": default_project.id,
                "organization_id": None,
                "public_key": None,
                "trigger": "test",
            },
            {
                "project_id": None,
                "organization_id": default_organization.id,
                "public_key": None,
                "trigger": "test",
            },
        ]

    def test_invalidate(
        self,
        monkeypatch,
        default_project,
        default_organization,
        default_projectkey,
        task_runner,
        redis_cache,
        django_cache,
    ):
        cfg = {"dummy-key": "val"}
        redis_cache.set_many({default_projectkey.public_key: cfg})
        assert redis_cache.get(default_projectkey.public_key) == cfg

        with task_runner():
            schedule_invalidate_project_config(project_id=default_project.id, trigger="test")

        for cache_key in _cache_keys_for_project(default_project):
            cfg_from_cache = redis_cache.get(cache_key)
            assert "dummy-key" not in cfg_from_cache
            assert cfg_from_cache["disabled"] is False
            assert cfg_from_cache["projectId"] == default_project.id

    def test_invalidate_org(
        self,
        monkeypatch,
        default_project,
        default_organization,
        default_projectkey,
        redis_cache,
        task_runner,
        django_cache,
    ):
        # Currently for org-wide we delete the config instead of computing it.
        cfg = {"dummy-key": "val"}
        redis_cache.set_many({default_projectkey.public_key: cfg})
        assert redis_cache.get(default_projectkey.public_key) == cfg

        with task_runner():
            schedule_invalidate_project_config(
                organization_id=default_organization.id, trigger="test"
            )

        for cache_key in _cache_keys_for_project(default_project):
            new_cfg = redis_cache.get(cache_key)
            assert new_cfg is not None
            assert new_cfg != cfg

    @mock.patch(
        "sentry.tasks.relay._schedule_invalidate_project_config",
        wraps=_schedule_invalidate_project_config,
    )
    @mock.patch("django.db.transaction.on_commit", wraps=transaction.on_commit)
    def test_project_config_invalidations_after_commit(
        self,
        oncommit,
        schedule_inner,
        default_project,
    ):
        schedule_invalidate_project_config(
            trigger="test", project_id=default_project.id, countdown=2
        )

        assert oncommit.call_count == 1
        assert schedule_inner.call_count == 1
        assert schedule_inner.call_args == call(
            trigger="test",
            organization_id=None,
            project_id=default_project.id,
            public_key=None,
            countdown=2,
        )

    @mock.patch("sentry.tasks.relay._schedule_invalidate_project_config")
    def test_project_config_invalidations_delayed(
        self,
        schedule_inner,
        default_project,
    ):
        with transaction.atomic(router.db_for_write(ProjectOption)):
            schedule_invalidate_project_config(
                trigger="inside-transaction", project_id=default_project, countdown=2
            )
            assert schedule_inner.call_count == 0

        assert schedule_inner.call_count == 1
        schedule_invalidate_project_config(
            trigger="outside-transaction", project_id=default_project, countdown=2
        )
        assert schedule_inner.call_count == 2


@django_db_all(transaction=True)
def test_invalidate_hierarchy(
    monkeypatch,
    default_project,
    default_projectkey,
    redis_cache,
    debounce_cache,
    invalidation_debounce_cache,
    django_cache,
):
    # Put something in the cache, otherwise the invalidation task won't compute anything.
    redis_cache.set_many({default_projectkey.public_key: {"dummy": "dummy"}})

    orig_apply_async = invalidate_project_config.apply_async
    calls = []

    def proxy(*args, **kwargs):
        calls.append((args, kwargs))
        orig_apply_async(*args, **kwargs)

    monkeypatch.setattr(invalidate_project_config, "apply_async", proxy)

    with BurstTaskRunner() as run:
        schedule_invalidate_project_config(
            organization_id=default_project.organization.id, trigger="test"
        )
        schedule_invalidate_project_config(project_id=default_project.id, trigger="test")
        run(max_jobs=10)

    assert len(calls) == 1
    cache = redis_cache.get(default_projectkey)
    assert cache["disabled"] is False


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

    @responses.activate
    def test_fetch_ai_model_costs_success(self):
        """Test successful fetching and caching of AI model costs"""
        self._mock_openrouter_api_response(MOCK_OPENROUTER_API_RESPONSE)

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
        mock_response = {
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

        responses.add(
            responses.GET,
            OPENROUTER_MODELS_API_URL,
            json=mock_response,
            status=200,
        )

        fetch_ai_model_costs()

        # Verify only valid models are cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is not None
        models = cached_data.get("models")
        assert models is not None
        assert len(models) == 3

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

    @responses.activate
    def test_fetch_ai_model_costs_invalid_response_format(self):
        """Test handling of invalid API response format"""
        # Invalid response - missing 'data' field
        mock_response = {"invalid": "response"}

        responses.add(
            responses.GET,
            OPENROUTER_MODELS_API_URL,
            json=mock_response,
            status=200,
        )

        fetch_ai_model_costs()

        # Verify nothing was cached
        cached_data = _get_ai_model_costs_from_cache()
        assert cached_data is None

    @responses.activate
    def test_fetch_ai_model_costs_http_error(self):
        """Test handling of HTTP errors"""
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
