from sentry.telemetry_classifiers.inputs import prepare_input
from sentry.telemetry_classifiers.types import InputSpec, Message, PreparedInput

USER_ONLY = InputSpec(roles=frozenset({"user"}), max_chars=10)


def user(content: str) -> Message:
    return Message(role="user", content=content)


def test_keeps_input_within_allowance_in_order() -> None:
    prepared = prepare_input([user("one"), user("two")], USER_ONLY, source_truncated=False)

    assert prepared == PreparedInput(
        messages=(user("one"), user("two")),
        input_truncated=False,
        source_truncated=False,
    )
    assert not prepared.truncated


def test_leaves_out_other_roles_and_blank_messages() -> None:
    messages = [
        Message(role="system", content="You are helpful."),
        user("hi"),
        Message(role="assistant", content="Hello!"),
        user("   "),
        user(""),
        user("bye"),
    ]

    prepared = prepare_input(messages, USER_ONLY, source_truncated=False)

    assert prepared.messages == (user("hi"), user("bye"))
    assert not prepared.input_truncated


def test_other_roles_do_not_use_the_allowance() -> None:
    messages = [Message(role="assistant", content="x" * 100), user("hello")]

    prepared = prepare_input(messages, USER_ONLY, source_truncated=False)

    assert prepared.messages == (user("hello"),)
    assert not prepared.input_truncated


def test_keeps_newest_content_when_input_is_too_large() -> None:
    messages = [user("oldest"), user("older"), user("newest")]

    prepared = prepare_input(messages, USER_ONLY, source_truncated=False)

    # "newest" uses 6 of 10 characters; the end of "older" fills the rest.
    assert prepared.messages == (user("lder"), user("newest"))
    assert prepared.input_truncated


def test_drops_older_messages_once_the_allowance_is_used() -> None:
    messages = [user("old"), user("x" * 10)]

    prepared = prepare_input(messages, USER_ONLY, source_truncated=False)

    assert prepared.messages == (user("x" * 10),)
    assert prepared.input_truncated


def test_keeps_end_of_a_single_oversized_message() -> None:
    prepared = prepare_input([user("abcdefghijklmnop")], USER_ONLY, source_truncated=False)

    assert prepared.messages == (user("ghijklmnop"),)
    assert prepared.input_truncated


def test_carries_source_truncation() -> None:
    prepared = prepare_input([user("hi")], USER_ONLY, source_truncated=True)

    assert prepared.source_truncated
    assert not prepared.input_truncated
    assert prepared.truncated


def test_returns_no_messages_when_nothing_is_usable() -> None:
    messages = [Message(role="assistant", content="Hello!")]

    prepared = prepare_input(messages, USER_ONLY, source_truncated=False)

    assert prepared.messages == ()
    assert not prepared.truncated
