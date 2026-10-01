---
name: seer-oneshot
description: Call a Seer one-shot (one synchronous structured LLM call) from Sentry, or add a new one. Covers run_oneshot, the payload and result contract, the Seer PR that must register the handler, feature gating, fallbacks, and tests. Use when asked to "call Seer", "add a one-shot", "run_oneshot", "oneshot_id", "ask the LLM for a name, title, or score", or when a change needs an LLM call with no tools and no background run. Also use when an error says "Unknown oneshot_id".
---

# Seer One-Shots

A one-shot is one synchronous LLM call that Seer runs for Sentry. Sentry posts `{oneshot_id, payload}` to Seer's `/v1/automation/oneshot/run`. Seer runs the handler registered under that id and answers `{result}` inline. There is no background run, no `run_id`, no tools, and no push-back to Sentry.

## The handler lives in the Seer repo

`run_oneshot("my_id", ...)` only works once `getsentry/seer` has a handler registered under `my_id`. Until then, every call fails with:

```
SeerApiError: {"detail":"Unknown oneshot_id: my_id"}
```

and the Sentry caller takes its error path. Nothing in this repo registers a one-shot, and no feature flag changes that.

A Sentry change that introduces a new `oneshot_id` is not done until a Seer PR that registers the handler is open, merged, and deployed. Say so in your report, and open the Seer PR (or hand the user the handler to open it) before you call the Sentry work complete. Land the Seer PR first.

## Calling an existing one-shot

```python
from sentry.seer.oneshot import run_oneshot

def suggest_name(payload: dict[str, Any], organization: Organization, user_id: int | None) -> str | None:
    try:
        result = run_oneshot("my_id", payload, organization, user_id=user_id, timeout=10)
    except Exception:
        logger.exception("my_feature.suggestion.failed")
        metrics.incr("my_feature.suggestion", tags={"result": "request_error"})
        return None

    name = result.get("name")
    if not isinstance(name, str) or not name.strip():
        metrics.incr("my_feature.suggestion", tags={"result": "empty"})
        return None
    return name.strip()
```

Rules:

- `organization` is required. Seer needs viewer context with an organization. Pass `user_id` when a user triggered the call.
- `run_oneshot` raises `SeerApiError` on a non-2xx response and returns `{}` when Seer answers without a `result`. Catch, log, count a metric, and fall back. A one-shot must never block the caller.
- Validate the result against the contract you expect. Seer returns a plain dict; check types, strip, and truncate to the model field's `max_length`.
- Gate the call behind a feature flag and the AI opt-out:

```python
if not features.has("organizations:my-feature", organization, actor=request.user) or organization.get_option("sentry:hide_ai_features", False):
    return None
```

- Keep the payload small and plain: snake_case keys, strings and lists. Seer parses it with a Pydantic model that ignores unknown keys.

Existing callers to model on:

- `src/sentry/api/endpoints/project_custom_inbound_filter_validate.py` (`inbound_filter_name`): a name for a filter draft.
- `src/sentry/ai_monitoring/conversation_titles.py` (`conversation_title`): a title for a conversation.
- `src/sentry/seer/run_questions.py` (`agent_question`): a structured answer to a question.

## Adding a new one-shot

1. Define the contract. Write down the payload dict Sentry sends and the result dict Seer returns. Put both in the Sentry caller's docstring and in the Seer handler's docstring, and keep them in sync.

2. Open the Seer PR first. In `getsentry/seer`:
   - Add `src/seer/automation/oneshot/handlers/<id>.py`. Decorate a class with `@oneshot("<id>")` and implement `run` and `arun`. Parse the payload with a Pydantic model (`extra="ignore"`), build the prompt with static instructions first and the untrusted payload last, call `get_llm_client().generate_structured(...)` with `gemini_flash_lite_models()` and a result model, and return `OneShotRunResponse(result=parsed.model_dump())`. Return `OneShotRunResponse(result={})` when the model gives nothing usable.
   - Import the module in `src/seer/automation/oneshot/handlers/__init__.py`. That import is what registers the id.
   - Add `tests/automation/oneshot/test_<id>.py`. Patch `get_llm_client` in the handler module and dispatch through `arun_oneshot`.
   - Model the handler on `src/seer/automation/oneshot/handlers/conversation_title.py`.

3. Open the Sentry PR second, with the caller from the section above. The caller must tolerate the unknown-id error anyway, because Seer and Sentry deploy independently.

## Testing the Sentry side

Patch `run_oneshot` where the caller imports it, not in `sentry.seer.oneshot`:

```python
with patch("sentry.api.endpoints.my_endpoint.run_oneshot", return_value={"name": "Flaky connection errors"}):
    ...
with patch("sentry.api.endpoints.my_endpoint.run_oneshot", side_effect=SeerApiError("boom", 500)):
    ...
```

Cover the success path, the error path, an empty or malformed result, the feature flag off, and `sentry:hide_ai_features` set.
