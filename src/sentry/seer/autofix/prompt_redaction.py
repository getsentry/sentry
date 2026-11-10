from __future__ import annotations

from django.http import HttpRequest
from rest_framework.request import Request

from sentry.auth.elevated_mode import has_elevated_mode
from sentry.seer.agent.client_models import MemoryBlock, SeerRunState
from sentry.seer.autofix.steps import AutofixStep

AUTOFIX_PROMPT_PLACEHOLDER = "Started Autofix"

_STEP_PROMPT_STEPS = frozenset(step.value for step in AutofixStep)


def can_see_autofix_prompts(request: HttpRequest | Request) -> bool:
    return has_elevated_mode(request)


def _step(block: MemoryBlock) -> str | None:
    if block.message.role != "user":
        return None
    return (block.message.metadata or {}).get("step")


def _redacted(block: MemoryBlock) -> MemoryBlock:
    return block.copy(
        update={"message": block.message.copy(update={"content": AUTOFIX_PROMPT_PLACEHOLDER})}
    )


def redact_autofix_prompts(state: SeerRunState, *, can_see_prompts: bool) -> SeerRunState:
    if can_see_prompts:
        return state
    blocks = [
        _redacted(block) if _step(block) in _STEP_PROMPT_STEPS else block for block in state.blocks
    ]
    return state.copy(update={"blocks": blocks})
