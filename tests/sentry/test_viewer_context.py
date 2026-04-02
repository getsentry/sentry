from __future__ import annotations

import contextvars
import dataclasses
import threading

import pytest

from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    get_viewer_context,
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
