from opentelemetry import trace
from opentelemetry.propagate import set_global_textmap
from opentelemetry.sdk.trace import TracerProvider, Span, ReadableSpan

from sentry_sdk_alpha.opentelemetry import (
    SentryPropagator,
    SentrySampler,
    SentrySpanProcessor,
)


def patch_readable_span():
    # type: () -> None
    """
    We need to pass through sentry specific metadata/objects from Span to ReadableSpan
    to work with them consistently in the SpanProcessor.
    """
    old_readable_span = Span._readable_span

    def sentry_patched_readable_span(self):
        # type: (Span) -> ReadableSpan
        readable_span = old_readable_span(self)
        readable_span._sentry_meta = getattr(self, "_sentry_meta", {})  # type: ignore[attr-defined]
        return readable_span

    Span._readable_span = sentry_patched_readable_span  # type: ignore[method-assign]


def setup_sentry_tracing():
    # type: () -> None
    provider = TracerProvider(sampler=SentrySampler())
    provider.add_span_processor(SentrySpanProcessor())
    trace.set_tracer_provider(provider)

    set_global_textmap(SentryPropagator())
