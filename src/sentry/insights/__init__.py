from typing import Any, NamedTuple

from sentry.constants import InsightModules


class FilterSpan(NamedTuple):
    """Interface for detecting relevant Insights modules for a span.

    Spans in transactions have a different schema than spans from Kafka. Going through this interface
    makes the classification schema-agnostic.
    """

    op: str | None
    category: str | None
    description: str | None
    transaction_op: str | None
    gen_ai_op_name: str | None

    @classmethod
    def from_span_v1(cls, span: dict[str, Any]) -> "FilterSpan":
        """Get relevant fields from a span as they appear in transaction payloads."""
        return cls(
            op=span.get("op"),
            category=span.get("sentry_tags", {}).get("category"),
            description=span.get("description"),
            transaction_op=span.get("sentry_tags", {}).get("transaction.op"),
            gen_ai_op_name=None,
        )

    @classmethod
    def from_span_attributes(cls, attributes: dict[str, Any]) -> "FilterSpan":
        """Get relevant fields from `span.attributes`."""
        return cls(
            op=(attributes.get("sentry.op") or {}).get("value"),
            category=(attributes.get("sentry.category") or {}).get("value"),
            description=(attributes.get("sentry.description") or {}).get("value"),
            transaction_op=(attributes.get("sentry.transaction_op") or {}).get("value"),
            gen_ai_op_name=(attributes.get("gen_ai.operation.name") or {}).get("value"),
        )


def is_http(span: FilterSpan) -> bool:
    return span.category == "http" and span.op == "http.client"


def is_db(span: FilterSpan) -> bool:
    return span.category == "db" and span.description is not None


def is_assets(span: FilterSpan) -> bool:
    return span.op in ["resource.script", "resource.css", "resource.font", "resource.img"]


def is_app_start(span: FilterSpan) -> bool:
    return span.op is not None and span.op.startswith("app.start.")


def is_screen_load(span: FilterSpan) -> bool:
    return span.transaction_op == "ui.load"


def is_vital(span: FilterSpan) -> bool:
    return span.transaction_op == "pageload"


def is_cache(span: FilterSpan) -> bool:
    return span.op in ["cache.get_item", "cache.get", "cache.put"]


def is_queue(span: FilterSpan) -> bool:
    return span.op in ["queue.process", "queue.publish"]


def is_agents(span: FilterSpan) -> bool:
    return span.gen_ai_op_name is not None or (span.op is not None and span.op.startswith("gen_ai"))


def is_mcp(span: FilterSpan) -> bool:
    return span.op is not None and span.op.startswith("mcp.")


INSIGHT_MODULE_FILTERS = {
    InsightModules.HTTP: is_http,
    InsightModules.DB: is_db,
    InsightModules.ASSETS: is_assets,
    InsightModules.APP_START: is_app_start,
    InsightModules.SCREEN_LOAD: is_screen_load,
    InsightModules.VITAL: is_vital,
    InsightModules.CACHE: is_cache,
    InsightModules.QUEUE: is_queue,
    InsightModules.AGENTS: is_agents,
    InsightModules.MCP: is_mcp,
}


def modules(spans: list[FilterSpan]) -> set[InsightModules]:
    return {
        module
        for module, is_module in INSIGHT_MODULE_FILTERS.items()
        if any(is_module(span) for span in spans)
    }
