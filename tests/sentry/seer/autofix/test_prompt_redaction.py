from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.prompt_redaction import (
    AUTOFIX_PROMPT_PLACEHOLDER,
    redact_autofix_prompts,
)


def _block(index: int, role: str, content: str, step: str | None = None) -> MemoryBlock:
    return MemoryBlock(
        id=str(index),
        message=Message(role=role, content=content, metadata={"step": step} if step else None),
        timestamp="2026-01-01T00:00:00Z",
    )


def _state(*blocks: MemoryBlock) -> SeerRunState:
    return SeerRunState(
        run_id=1, blocks=list(blocks), status="completed", updated_at="2026-01-01T00:00:00Z"
    )


def _contents(state: SeerRunState) -> list[str | None]:
    return [block.message.content for block in state.blocks]


def test_keeps_single_run_messages() -> None:
    state = _state(
        _block(0, "user", "Fix issue ABC-1", "single_run"),
        _block(1, "assistant", "Found it."),
        _block(2, "user", "Nice, make a code fix", "single_run"),
    )

    redacted = redact_autofix_prompts(state)

    assert _contents(redacted) == ["Fix issue ABC-1", "Found it.", "Nice, make a code fix"]


def test_hides_every_step_prompt_in_a_step_by_step_run() -> None:
    state = _state(
        _block(0, "user", "Analyze issue ABC-1 ...", "root_cause"),
        _block(1, "assistant", "Root cause."),
        _block(2, "user", "Plan a solution ...", "solution"),
    )

    redacted = redact_autofix_prompts(state)

    assert _contents(redacted) == [
        AUTOFIX_PROMPT_PLACEHOLDER,
        "Root cause.",
        AUTOFIX_PROMPT_PLACEHOLDER,
    ]


def test_keeps_a_plain_chat_message() -> None:
    state = _state(_block(0, "user", "What is this error about?"))

    assert _contents(redact_autofix_prompts(state)) == ["What is this error about?"]
