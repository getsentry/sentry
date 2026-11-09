from __future__ import annotations

from django.http import HttpRequest
from rest_framework.request import Request

from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.seer.agent.client_models import MemoryBlock, SeerRunState
from sentry.seer.autofix.steps import AutofixStep

AUTOFIX_PROMPT_PLACEHOLDER = "Started Autofix"

_SINGLE_RUN_STEP = "single_run"
_STEP_PROMPT_STEPS = frozenset(step.value for step in AutofixStep)


def can_see_autofix_prompts(request: HttpRequest | Request) -> bool:
    return is_active_staff(request) or is_active_superuser(request)


def _is_autofix_prompt(index: int, block: MemoryBlock) -> bool:
    if block.message.role != "user":
        return False
    step = (block.message.metadata or {}).get("step")
    # Single-run replies carry the same step tag, so only the opening message is a prompt.
    return step in _STEP_PROMPT_STEPS or (step == _SINGLE_RUN_STEP and index == 0)


def redact_autofix_prompts(state: SeerRunState, *, can_see_prompts: bool) -> SeerRunState:
    if can_see_prompts:
        return state
    blocks = [
        (
            block.copy(
                update={
                    "message": block.message.copy(update={"content": AUTOFIX_PROMPT_PLACEHOLDER})
                }
            )
            if _is_autofix_prompt(index, block)
            else block
        )
        for index, block in enumerate(state.blocks)
    ]
    return state.copy(update={"blocks": blocks})
