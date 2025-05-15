from typing import cast
from contextlib import contextmanager
import warnings

from opentelemetry.context import (
    get_value,
    set_value,
    attach,
    detach,
    get_current,
)
from opentelemetry.trace import (
    SpanContext,
    NonRecordingSpan,
    TraceFlags,
    TraceState,
    use_span,
)

from sentry_sdk_alpha.opentelemetry.consts import (
    SENTRY_SCOPES_KEY,
    SENTRY_FORK_ISOLATION_SCOPE_KEY,
    SENTRY_USE_CURRENT_SCOPE_KEY,
    SENTRY_USE_ISOLATION_SCOPE_KEY,
    TRACESTATE_SAMPLED_KEY,
)
from sentry_sdk_alpha.opentelemetry.contextvars_context import (
    SentryContextVarsRuntimeContext,
)
from sentry_sdk_alpha.opentelemetry.utils import trace_state_from_baggage
from sentry_sdk_alpha.scope import Scope, ScopeType
from sentry_sdk_alpha.tracing import Span
from sentry_sdk_alpha._types import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Tuple, Optional, Generator, Dict, Any


class PotelScope(Scope):
    @classmethod
    def _get_scopes(cls):
        # type: () -> Optional[Tuple[PotelScope, PotelScope]]
        """
        Returns the current scopes tuple on the otel context. Internal use only.
        """
        return cast(
            "Optional[Tuple[PotelScope, PotelScope]]", get_value(SENTRY_SCOPES_KEY)
        )

    @classmethod
    def get_current_scope(cls):
        # type: () -> PotelScope
        """
        Returns the current scope.
        """
        return cls._get_current_scope() or _INITIAL_CURRENT_SCOPE

    @classmethod
    def _get_current_scope(cls):
        # type: () -> Optional[PotelScope]
        """
        Returns the current scope without creating a new one. Internal use only.
        """
        scopes = cls._get_scopes()
        return scopes[0] if scopes else None

    @classmethod
    def get_isolation_scope(cls):
        # type: () -> PotelScope
        """
        Returns the isolation scope.
        """
        return cls._get_isolation_scope() or _INITIAL_ISOLATION_SCOPE

    @classmethod
    def _get_isolation_scope(cls):
        # type: () -> Optional[PotelScope]
        """
        Returns the isolation scope without creating a new one. Internal use only.
        """
        scopes = cls._get_scopes()
        return scopes[1] if scopes else None

    @contextmanager
    def continue_trace(self, environ_or_headers):
        # type: (Dict[str, Any]) -> Generator[None, None, None]
        """
        Sets the propagation context from environment or headers to continue an incoming trace.
        Any span started within this context manager will use the same trace_id, parent_span_id
        and inherit the sampling decision from the incoming trace.
        """
        self.generate_propagation_context(environ_or_headers)

        span_context = self._incoming_otel_span_context()
        if span_context is None:
            yield
        else:
            with use_span(NonRecordingSpan(span_context)):
                yield

    def _incoming_otel_span_context(self):
        # type: () -> Optional[SpanContext]
        if self._propagation_context is None:
            return None
        # If sentry-trace extraction didn't have a parent_span_id, we don't have an upstream header
        if self._propagation_context.parent_span_id is None:
            return None

        trace_flags = TraceFlags(
            TraceFlags.SAMPLED
            if self._propagation_context.parent_sampled
            else TraceFlags.DEFAULT
        )

        if self._propagation_context.baggage:
            trace_state = trace_state_from_baggage(self._propagation_context.baggage)
        else:
            trace_state = TraceState()

        # for twp to work, we also need to consider deferred sampling when the sampling
        # flag is not present, so the above TraceFlags are not sufficient
        if self._propagation_context.parent_sampled is None:
            trace_state = trace_state.update(TRACESTATE_SAMPLED_KEY, "deferred")

        span_context = SpanContext(
            trace_id=int(self._propagation_context.trace_id, 16),
            span_id=int(self._propagation_context.parent_span_id, 16),
            is_remote=True,
            trace_flags=trace_flags,
            trace_state=trace_state,
        )

        return span_context

    def start_transaction(self, **kwargs):
        # type: (Any) -> Span
        """
        .. deprecated:: 3.0.0
            This function is deprecated and will be removed in a future release.
            Use :py:meth:`sentry_sdk.start_span` instead.
        """
        warnings.warn(
            "The `start_transaction` method is deprecated, please use `sentry_sdk.start_span instead.`",
            DeprecationWarning,
            stacklevel=2,
        )
        return self.start_span(**kwargs)

    def start_span(self, **kwargs):
        # type: (Any) -> Span
        return Span(**kwargs)


_INITIAL_CURRENT_SCOPE = PotelScope(ty=ScopeType.CURRENT)
_INITIAL_ISOLATION_SCOPE = PotelScope(ty=ScopeType.ISOLATION)


def setup_initial_scopes():
    # type: () -> None
    global _INITIAL_CURRENT_SCOPE, _INITIAL_ISOLATION_SCOPE
    _INITIAL_CURRENT_SCOPE = PotelScope(ty=ScopeType.CURRENT)
    _INITIAL_ISOLATION_SCOPE = PotelScope(ty=ScopeType.ISOLATION)

    scopes = (_INITIAL_CURRENT_SCOPE, _INITIAL_ISOLATION_SCOPE)
    attach(set_value(SENTRY_SCOPES_KEY, scopes))


def setup_scope_context_management():
    # type: () -> None
    import opentelemetry.context

    opentelemetry.context._RUNTIME_CONTEXT = SentryContextVarsRuntimeContext()
    setup_initial_scopes()


@contextmanager
def isolation_scope():
    # type: () -> Generator[PotelScope, None, None]
    context = set_value(SENTRY_FORK_ISOLATION_SCOPE_KEY, True)
    token = attach(context)
    try:
        yield PotelScope.get_isolation_scope()
    finally:
        detach(token)


@contextmanager
def new_scope():
    # type: () -> Generator[PotelScope, None, None]
    token = attach(get_current())
    try:
        yield PotelScope.get_current_scope()
    finally:
        detach(token)


@contextmanager
def use_scope(scope):
    # type: (PotelScope) -> Generator[PotelScope, None, None]
    context = set_value(SENTRY_USE_CURRENT_SCOPE_KEY, scope)
    token = attach(context)

    try:
        yield scope
    finally:
        detach(token)


@contextmanager
def use_isolation_scope(isolation_scope):
    # type: (PotelScope) -> Generator[PotelScope, None, None]
    context = set_value(SENTRY_USE_ISOLATION_SCOPE_KEY, isolation_scope)
    token = attach(context)

    try:
        yield isolation_scope
    finally:
        detach(token)
