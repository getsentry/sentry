from typing import NamedTuple

from sentry.constants import InsightModules


class ClassifiableSpan(NamedTuple):
    """Interface for detecting relevant Insights modules for a span.

    Spans in transactions have a different schema than spans from Kafka. Going through this interface
    makes the classification schema-agnostic.
    """

    op: str | None
    category: str | None
    description: str | None
    transaction_op: str | None


def is_http(span: ClassifiableSpan) -> bool:
    return span.category == "http" and span.op == "http.client"


def is_db(span: ClassifiableSpan) -> bool:
    return span.category == "db" and span.description is not None


def is_assets(span: ClassifiableSpan) -> bool:
    return span.op in ["resource.script", "resource.css", "resource.font", "resource.img"]


def is_app_start(span: ClassifiableSpan) -> bool:
    return span.op is not None and span.op.startswith("app.start.")


def is_screen_load(span: ClassifiableSpan) -> bool:
    return span.category == "ui" and span.transaction_op == "ui.load"


def is_vital(span: ClassifiableSpan) -> bool:
    return span.transaction_op == "pageload"


def is_cache(span: ClassifiableSpan) -> bool:
    return span.op in ["cache.get_item", "cache.get", "cache.put"]


def is_queue(span: ClassifiableSpan) -> bool:
    return span.op in ["queue.process", "queue.publish"]


def is_llm_monitoring(span: ClassifiableSpan) -> bool:
    return span.op is not None and span.op.startswith("ai.pipeline")


def is_agents(span: ClassifiableSpan) -> bool:
    return span.op is not None and span.op.startswith("gen_ai.")


def is_mcp(span: ClassifiableSpan) -> bool:
    return span.op is not None and span.op.startswith("mcp.")


INSIGHT_MODULE_CLASSIFIERS = {
    InsightModules.HTTP: is_http,
    InsightModules.DB: is_db,
    InsightModules.ASSETS: is_assets,
    InsightModules.APP_START: is_app_start,
    InsightModules.SCREEN_LOAD: is_screen_load,
    InsightModules.VITAL: is_vital,
    InsightModules.CACHE: is_cache,
    InsightModules.QUEUE: is_queue,
    InsightModules.LLM_MONITORING: is_llm_monitoring,
    InsightModules.AGENTS: is_agents,
    InsightModules.MCP: is_mcp,
}


def modules(spans: list[ClassifiableSpan]) -> set[InsightModules]:
    return {
        module
        for module, is_module in INSIGHT_MODULE_CLASSIFIERS.items()
        if any(is_module(span) for span in spans)
    }
