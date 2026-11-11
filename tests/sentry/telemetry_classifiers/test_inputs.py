from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.telemetry_classifiers.inputs import prepare_messages
from sentry.telemetry_classifiers.types import Message, PreparedInput


@pytest.fixture(autouse=True)
def small_input_limit() -> Generator[None]:
    with patch("sentry.telemetry_classifiers.inputs.MAX_INPUT_CHARS", 10):
        yield


def user(content: str) -> Message:
    return Message(role="user", content=content)


def test_keeps_messages_within_limit_in_order() -> None:
    prepared = prepare_messages([user("one"), user("two")])

    assert prepared == PreparedInput(messages=(user("one"), user("two")), truncated=False)


def test_leaves_out_other_roles_and_blank_messages() -> None:
    messages = [
        Message(role="system", content="You are helpful."),
        user("hi"),
        Message(role="assistant", content="x" * 100),
        user("   "),
        user(""),
        user("bye"),
    ]

    prepared = prepare_messages(messages)

    assert prepared == PreparedInput(messages=(user("hi"), user("bye")), truncated=False)


def test_keeps_newest_content_when_input_is_too_large() -> None:
    prepared = prepare_messages([user("oldest"), user("older"), user("newest")])

    # "newest" uses 6 of 10 characters; the end of "older" fills the rest.
    assert prepared == PreparedInput(messages=(user("lder"), user("newest")), truncated=True)


def test_drops_older_messages_once_the_limit_is_used() -> None:
    prepared = prepare_messages([user("old"), user("x" * 10)])

    assert prepared == PreparedInput(messages=(user("x" * 10),), truncated=True)


def test_returns_no_messages_without_user_text() -> None:
    prepared = prepare_messages([Message(role="assistant", content="Hello!")])

    assert prepared == PreparedInput(messages=(), truncated=False)
