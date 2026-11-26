from __future__ import annotations

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.steps import AutofixStep

AUTOFIX_PROMPT_PLACEHOLDER = "Started Autofix"

_AUTOFIX_STEPS = frozenset(step.value for step in AutofixStep)


def redact_autofix_prompts(state: SeerRunState) -> SeerRunState:
    blocks = [
        (
            block.copy(
                update={
                    "message": block.message.copy(update={"content": AUTOFIX_PROMPT_PLACEHOLDER})
                }
            )
            if block.message.role == "user"
            and (block.message.metadata or {}).get("step") in _AUTOFIX_STEPS
            else block
        )
        for block in state.blocks
    ]
    return state.copy(update={"blocks": blocks})
