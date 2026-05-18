from __future__ import annotations

import contextvars
import dataclasses
import threading
from unittest import mock

import pytest

from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    get_viewer_context,
    observe_viewer_context_propagation,
    set_viewer_context_organization,
    viewer_context_scope,
)


class TestActorType:
    def test_values_are_strings(self):
        assert ActorType.USER == "user"
        assert ActorType.SYSTEM == "system"
        assert ActorType.INTEGRATION == "integration"
        assert ActorType.UNKNOWN == "unknown"


class TestViewerContext:
    def test_defaults(self):
        ctx = ViewerContext()
        assert ctx.organization_id is None
        assert ctx.user_id is None
        assert ctx.actor_type is ActorType.UNKNOWN
        assert ctx.token is None

    def test_frozen(self):
        ctx = ViewerContext(user_id=1)
        with pytest.raises(dataclasses.FrozenInstanceError):
            ctx.user_id = 2  # type: ignore[misc]

    def test_construction(self):
        ctx = ViewerContext(
            organization_id=10,
            user_id=42,
            actor_type=ActorType.SYSTEM,
        )
        assert ctx.organization_id == 10
        assert ctx.user_id == 42
        assert ctx.actor_type is ActorType.SYSTEM


class TestViewerContextScope:
    def test_get_returns_none_outside_scope(self):
        assert get_viewer_context() is None

    def test_scope_sets_and_resets(self):
        ctx = ViewerContext(user_id=1)
        assert get_viewer_context() is None

        with viewer_context_scope(ctx):
            assert get_viewer_context() is ctx

        assert get_viewer_context() is None

    def test_nested_scopes(self):
        outer = ViewerContext(user_id=1)
        inner = ViewerContext(user_id=2)

        with viewer_context_scope(outer):
            assert get_viewer_context() is outer

            with viewer_context_scope(inner):
                assert get_viewer_context() is inner

            assert get_viewer_context() is outer

        assert get_viewer_context() is None

    def test_cleanup_on_exception(self):
        ctx = ViewerContext(user_id=1)

        with pytest.raises(RuntimeError):
            with viewer_context_scope(ctx):
                assert get_viewer_context() is ctx
                raise RuntimeError("boom")

        assert get_viewer_context() is None

    def test_copy_context_propagates_to_thread(self):
        ctx = ViewerContext(user_id=1, organization_id=10)
        result: list[ViewerContext | None] = [None]

        with viewer_context_scope(ctx):
            copied = contextvars.copy_context()

            def _worker():
                result[0] = copied.run(get_viewer_context)

            t = threading.Thread(target=_worker)
            t.start()
            t.join()

        assert result[0] is ctx

    def test_context_propagating_thread_pool_executor(self):
        from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

        ctx = ViewerContext(user_id=7, organization_id=99, actor_type=ActorType.INTEGRATION)

        with viewer_context_scope(ctx):
            with ContextPropagatingThreadPoolExecutor(max_workers=1) as pool:
                result = pool.submit(get_viewer_context).result()

        assert result is ctx

    def test_context_propagating_executor_does_not_leak_across_submissions(self):
        from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

        ctx = ViewerContext(user_id=1)

        with ContextPropagatingThreadPoolExecutor(max_workers=1) as pool:
            # Submit inside a scope — worker should see ctx
            with viewer_context_scope(ctx):
                inside = pool.submit(get_viewer_context).result()

            # Submit outside any scope — worker should see None
            outside = pool.submit(get_viewer_context).result()

        assert inside is ctx
        assert outside is None

    def test_set_organization_updates_current_context(self):
        ctx = ViewerContext(user_id=1, actor_type=ActorType.USER)

        with viewer_context_scope(ctx):
            set_viewer_context_organization(42)
            updated = get_viewer_context()

            assert updated is not None
            assert updated.organization_id == 42
            assert updated.user_id == ctx.user_id
            assert updated.actor_type is ctx.actor_type

        assert get_viewer_context() is None

    def test_set_organization_is_noop_without_context(self):
        set_viewer_context_organization(42)

        assert get_viewer_context() is None


class TestObserve:
    @pytest.fixture(autouse=True)
    def patch_metrics(self):
        with mock.patch("sentry.viewer_context.sentry_sdk.metrics.count") as m:
            yield m

    def _tags(self, m):
        assert m.call_count == 1
        args, kwargs = m.call_args
        assert args == ("viewer_context.observation", 1)
        return kwargs["attributes"]

    def test_no_context_tags_actor_none(self, patch_metrics):
        observe_viewer_context_propagation("seer_rpc_out")
        tags = self._tags(patch_metrics)
        assert tags == {
            "point": "seer_rpc_out",
            "actor_type": "none",
            "has_user_id": "false",
            "has_org_id": "false",
            "expected": "true",
        }

    def test_with_context_tags_actor_and_presence_flags(self, patch_metrics):
        ctx = ViewerContext(user_id=42, organization_id=7, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            observe_viewer_context_propagation("seer_rpc_out")
        tags = self._tags(patch_metrics)
        assert tags["actor_type"] == "user"
        assert tags["has_user_id"] == "true"
        assert tags["has_org_id"] == "true"

    def test_partial_context_tags_individual_flags(self, patch_metrics):
        # User without org (e.g. cross-org admin lookup before org is resolved)
        ctx = ViewerContext(user_id=42, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            observe_viewer_context_propagation("rpc_inbound")
        tags = self._tags(patch_metrics)
        assert tags["has_user_id"] == "true"
        assert tags["has_org_id"] == "false"

    def test_explicit_ctx_overrides_contextvar(self, patch_metrics):
        # Caller passes a resolved value that's distinct from the contextvar
        with viewer_context_scope(ViewerContext(actor_type=ActorType.SYSTEM)):
            observe_viewer_context_propagation(
                "seer_rpc_out", ctx=ViewerContext(actor_type=ActorType.INTEGRATION)
            )
        tags = self._tags(patch_metrics)
        assert tags["actor_type"] == "integration"

    def test_explicit_ctx_none_treated_as_missing(self, patch_metrics):
        # Distinguishes "ctx wasn't passed" (sentinel) from "ctx is explicitly None"
        with viewer_context_scope(ViewerContext(actor_type=ActorType.USER)):
            observe_viewer_context_propagation("seer_rpc_out", ctx=None)
        tags = self._tags(patch_metrics)
        assert tags["actor_type"] == "none"

    def test_expected_false_does_not_log_when_missing(self, patch_metrics, caplog):
        observe_viewer_context_propagation("optional_point", expected=False)
        tags = self._tags(patch_metrics)
        assert tags["expected"] == "false"
        # No warning log for expected=False misses
        assert all(r.levelname != "WARNING" for r in caplog.records)

    def test_expected_true_logs_when_missing(self, patch_metrics, caplog):
        import logging

        with caplog.at_level(logging.WARNING, logger="sentry.viewer_context"):
            observe_viewer_context_propagation("rpc_inbound")
        assert any(r.message == "viewer_context.missing" for r in caplog.records)

    def test_expected_true_does_not_log_when_present(self, patch_metrics, caplog):
        ctx = ViewerContext(user_id=1, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            observe_viewer_context_propagation("rpc_inbound")
        assert all(r.message != "viewer_context.missing" for r in caplog.records)

    def test_extra_attributes_merged_into_metric_tags(self, patch_metrics):
        observe_viewer_context_propagation(
            "seer_rpc_in", extra_attributes={"method": "get_organization_slug"}
        )
        tags = self._tags(patch_metrics)
        assert tags["point"] == "seer_rpc_in"
        assert tags["method"] == "get_organization_slug"

    def test_extra_attributes_cannot_override_fixed_tags(self, patch_metrics):
        # Fixed tags must take precedence so callers can't accidentally swap
        # `point` or `actor_type` and corrupt the metric's cardinality story.
        ctx = ViewerContext(user_id=1, actor_type=ActorType.USER)
        with viewer_context_scope(ctx):
            observe_viewer_context_propagation(
                "seer_rpc_in",
                extra_attributes={"point": "hijacked", "method": "real_method"},
            )
        tags = self._tags(patch_metrics)
        assert tags["point"] == "seer_rpc_in"
        assert tags["method"] == "real_method"

    def test_extra_attributes_propagate_to_missing_log(self, patch_metrics, caplog):
        import logging

        with caplog.at_level(logging.WARNING, logger="sentry.viewer_context"):
            observe_viewer_context_propagation(
                "seer_rpc_in", extra_attributes={"method": "ghost_method"}
            )
        missing_records = [r for r in caplog.records if r.message == "viewer_context.missing"]
        assert len(missing_records) == 1
        assert missing_records[0].method == "ghost_method"
        assert missing_records[0].point == "seer_rpc_in"
