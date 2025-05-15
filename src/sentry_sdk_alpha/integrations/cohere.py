from functools import wraps

from sentry_sdk_alpha import consts
from sentry_sdk_alpha.ai.monitoring import record_token_usage
from sentry_sdk_alpha.consts import SPANDATA
from sentry_sdk_alpha.ai.utils import set_data_normalized

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any, Callable, Iterator
    from sentry_sdk_alpha.tracing import Span

import sentry_sdk_alpha
from sentry_sdk_alpha.scope import should_send_default_pii
from sentry_sdk_alpha.integrations import DidNotEnable, Integration
from sentry_sdk_alpha.utils import capture_internal_exceptions, event_from_exception

try:
    from cohere.client import Client
    from cohere.base_client import BaseCohere
    from cohere import (
        ChatStreamEndEvent,
        NonStreamedChatResponse,
    )

    if TYPE_CHECKING:
        from cohere import StreamedChatResponse
except ImportError:
    raise DidNotEnable("Cohere not installed")

try:
    # cohere 5.9.3+
    from cohere import StreamEndStreamedChatResponse
except ImportError:
    from cohere import StreamedChatResponse_StreamEnd as StreamEndStreamedChatResponse


COLLECTED_CHAT_PARAMS = {
    "model": SPANDATA.AI_MODEL_ID,
    "k": SPANDATA.AI_TOP_K,
    "p": SPANDATA.AI_TOP_P,
    "seed": SPANDATA.AI_SEED,
    "frequency_penalty": SPANDATA.AI_FREQUENCY_PENALTY,
    "presence_penalty": SPANDATA.AI_PRESENCE_PENALTY,
    "raw_prompting": SPANDATA.AI_RAW_PROMPTING,
}

COLLECTED_PII_CHAT_PARAMS = {
    "tools": SPANDATA.AI_TOOLS,
    "preamble": SPANDATA.AI_PREAMBLE,
}

COLLECTED_CHAT_RESP_ATTRS = {
    "generation_id": SPANDATA.AI_GENERATION_ID,
    "is_search_required": SPANDATA.AI_SEARCH_REQUIRED,
    "finish_reason": SPANDATA.AI_FINISH_REASON,
}

COLLECTED_PII_CHAT_RESP_ATTRS = {
    "citations": SPANDATA.AI_CITATIONS,
    "documents": SPANDATA.AI_DOCUMENTS,
    "search_queries": SPANDATA.AI_SEARCH_QUERIES,
    "search_results": SPANDATA.AI_SEARCH_RESULTS,
    "tool_calls": SPANDATA.AI_TOOL_CALLS,
}


class CohereIntegration(Integration):
    identifier = "cohere"
    origin = f"auto.ai.{identifier}"

    def __init__(self, include_prompts=True):
        # type: (CohereIntegration, bool) -> None
        self.include_prompts = include_prompts

    @staticmethod
    def setup_once():
        # type: () -> None
        BaseCohere.chat = _wrap_chat(BaseCohere.chat, streaming=False)
        Client.embed = _wrap_embed(Client.embed)
        BaseCohere.chat_stream = _wrap_chat(BaseCohere.chat_stream, streaming=True)


def _capture_exception(exc):
    # type: (Any) -> None
    event, hint = event_from_exception(
        exc,
        client_options=sentry_sdk_alpha.get_client().options,
        mechanism={"type": "cohere", "handled": False},
    )
    sentry_sdk_alpha.capture_event(event, hint=hint)


def _wrap_chat(f, streaming):
    # type: (Callable[..., Any], bool) -> Callable[..., Any]

    def collect_chat_response_fields(span, res, include_pii):
        # type: (Span, NonStreamedChatResponse, bool) -> None
        if include_pii:
            if hasattr(res, "text"):
                set_data_normalized(
                    span,
                    SPANDATA.AI_RESPONSES,
                    [res.text],
                )
            for pii_attr in COLLECTED_PII_CHAT_RESP_ATTRS:
                if hasattr(res, pii_attr):
                    set_data_normalized(span, "ai." + pii_attr, getattr(res, pii_attr))

        for attr in COLLECTED_CHAT_RESP_ATTRS:
            if hasattr(res, attr):
                set_data_normalized(span, "ai." + attr, getattr(res, attr))

        if hasattr(res, "meta"):
            if hasattr(res.meta, "billed_units"):
                record_token_usage(
                    span,
                    prompt_tokens=res.meta.billed_units.input_tokens,
                    completion_tokens=res.meta.billed_units.output_tokens,
                )
            elif hasattr(res.meta, "tokens"):
                record_token_usage(
                    span,
                    prompt_tokens=res.meta.tokens.input_tokens,
                    completion_tokens=res.meta.tokens.output_tokens,
                )

            if hasattr(res.meta, "warnings"):
                set_data_normalized(span, SPANDATA.AI_WARNINGS, res.meta.warnings)

    @wraps(f)
    def new_chat(*args, **kwargs):
        # type: (*Any, **Any) -> Any
        integration = sentry_sdk_alpha.get_client().get_integration(CohereIntegration)

        if (
            integration is None
            or "message" not in kwargs
            or not isinstance(kwargs.get("message"), str)
        ):
            return f(*args, **kwargs)

        message = kwargs.get("message")

        span = sentry_sdk_alpha.start_span(
            op=consts.OP.COHERE_CHAT_COMPLETIONS_CREATE,
            name="cohere.client.Chat",
            origin=CohereIntegration.origin,
            only_if_parent=True,
        )
        span.__enter__()
        try:
            res = f(*args, **kwargs)
        except Exception as e:
            _capture_exception(e)
            span.__exit__(None, None, None)
            raise e from None

        with capture_internal_exceptions():
            if should_send_default_pii() and integration.include_prompts:
                set_data_normalized(
                    span,
                    SPANDATA.AI_INPUT_MESSAGES,
                    list(
                        map(
                            lambda x: {
                                "role": getattr(x, "role", "").lower(),
                                "content": getattr(x, "message", ""),
                            },
                            kwargs.get("chat_history", []),
                        )
                    )
                    + [{"role": "user", "content": message}],
                )
                for k, v in COLLECTED_PII_CHAT_PARAMS.items():
                    if k in kwargs:
                        set_data_normalized(span, v, kwargs[k])

            for k, v in COLLECTED_CHAT_PARAMS.items():
                if k in kwargs:
                    set_data_normalized(span, v, kwargs[k])
            set_data_normalized(span, SPANDATA.AI_STREAMING, False)

            if streaming:
                old_iterator = res

                def new_iterator():
                    # type: () -> Iterator[StreamedChatResponse]

                    with capture_internal_exceptions():
                        for x in old_iterator:
                            if isinstance(x, ChatStreamEndEvent) or isinstance(
                                x, StreamEndStreamedChatResponse
                            ):
                                collect_chat_response_fields(
                                    span,
                                    x.response,
                                    include_pii=should_send_default_pii()
                                    and integration.include_prompts,
                                )
                            yield x

                    span.__exit__(None, None, None)

                return new_iterator()
            elif isinstance(res, NonStreamedChatResponse):
                collect_chat_response_fields(
                    span,
                    res,
                    include_pii=should_send_default_pii()
                    and integration.include_prompts,
                )
                span.__exit__(None, None, None)
            else:
                set_data_normalized(span, "unknown_response", True)
                span.__exit__(None, None, None)
            return res

    return new_chat


def _wrap_embed(f):
    # type: (Callable[..., Any]) -> Callable[..., Any]

    @wraps(f)
    def new_embed(*args, **kwargs):
        # type: (*Any, **Any) -> Any
        integration = sentry_sdk_alpha.get_client().get_integration(CohereIntegration)
        if integration is None:
            return f(*args, **kwargs)

        with sentry_sdk_alpha.start_span(
            op=consts.OP.COHERE_EMBEDDINGS_CREATE,
            name="Cohere Embedding Creation",
            origin=CohereIntegration.origin,
            only_if_parent=True,
        ) as span:
            if "texts" in kwargs and (
                should_send_default_pii() and integration.include_prompts
            ):
                if isinstance(kwargs["texts"], str):
                    set_data_normalized(span, SPANDATA.AI_TEXTS, [kwargs["texts"]])
                elif (
                    isinstance(kwargs["texts"], list)
                    and len(kwargs["texts"]) > 0
                    and isinstance(kwargs["texts"][0], str)
                ):
                    set_data_normalized(
                        span, SPANDATA.AI_INPUT_MESSAGES, kwargs["texts"]
                    )

            if "model" in kwargs:
                set_data_normalized(span, SPANDATA.AI_MODEL_ID, kwargs["model"])
            try:
                res = f(*args, **kwargs)
            except Exception as e:
                _capture_exception(e)
                raise e from None
            if (
                hasattr(res, "meta")
                and hasattr(res.meta, "billed_units")
                and hasattr(res.meta.billed_units, "input_tokens")
            ):
                record_token_usage(
                    span,
                    prompt_tokens=res.meta.billed_units.input_tokens,
                    total_tokens=res.meta.billed_units.input_tokens,
                )
            return res

    return new_embed
