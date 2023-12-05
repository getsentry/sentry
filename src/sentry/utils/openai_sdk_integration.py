import hashlib

from sentry_sdk.hub import Hub
from sentry_sdk.integrations import DidNotEnable, Integration

try:
    from openai import resources
except ImportError:
    raise DidNotEnable("OpenAI is not installed")


class OpenAiIntegration(Integration):
    identifier = "openai"

    def __init__(self, capture_prompts=False):
        self.capture_prompts = capture_prompts

    @staticmethod
    def setup_once():
        patch_openai()


def patch_openai():
    old_open_ai_resources_chat_completions_create = resources.chat.completions.Completions.create

    def monkeypatched_openai_completions_create(*args, **kwargs):
        hub = Hub.current

        integration = hub.get_integration(OpenAiIntegration)
        if integration is None:
            return old_open_ai_resources_chat_completions_create(*args, **kwargs)

        # for now, simply make the description (which is how grouping is defined)
        # simply the first message in the chat. This is not ideal, but it's a start.
        with hub.start_span(
            op="ai.llm.completion",
            description=_get_description(kwargs.get("messages"), integration.capture_prompts),
        ) as span:
            if integration.capture_prompts:
                span.set_data(
                    "chat_completion_input",
                    {"messages": kwargs.get("messages")},
                )
            return_value = old_open_ai_resources_chat_completions_create(*args, **kwargs)
            if getattr(return_value, "usage", None):
                completion_output = {
                    "created": return_value.created,
                    "id": return_value.id,
                }
                if integration.capture_prompts:
                    completion_output["choices"] = return_value.model_dump(exclude_unset=True).get(
                        "choices"
                    )

                span.set_data(
                    "chat_completion_output",
                    completion_output,
                )
                span.set_data("llm_prompt_tkens", return_value.usage.prompt_tokens)
                span.set_data("llm_completion_tkens", return_value.usage.completion_tokens)
                span.set_data("llm_total_tkens", return_value.usage.total_tokens)
                span.set_data("language_model", return_value.model)
            return return_value

    resources.chat.completions.Completions.create = monkeypatched_openai_completions_create  # type: ignore[method-assign]


def _get_description(messages, capture_prompts):
    if messages is None or len(messages) == 0:
        return ""
    if capture_prompts:
        # TODO: should we handle truncation here?
        return messages[0]["content"]
    else:
        return hashlib.md5(messages[0]["content"].encode("utf-8")).hexdigest()
