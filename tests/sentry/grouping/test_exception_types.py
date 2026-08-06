import pytest

from sentry.grouping.ingest.exception_types import (
    REJECTING_REASONS,
    MismatchReason,
    classify_exception_type_mismatch,
)


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        ("Fatal App Hang Fully Blocked", "App Hang Fully Blocked"),
        ("App Hang Non Fully Blocked", "Fatal App Hang Non Fully Blocked"),
        # Fatality still decides when the blocked dimension or the spelling also differs
        ("Fatal App Hang Fully Blocked", "App Hang Non Fully Blocked"),
        ("Fatal App Hanging", "App Hang Fully Blocked"),
    ],
    ids=str,
)
def test_rejects_app_hangs_of_differing_fatality(event_type: str, parent_type: str) -> None:
    reason = classify_exception_type_mismatch(event_type, parent_type, "cocoa")

    assert reason == MismatchReason.APP_HANG_FATALITY
    assert reason in REJECTING_REASONS


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        # Blocked dimension alone
        ("Fatal App Hang Fully Blocked", "Fatal App Hang Non Fully Blocked"),
        ("App Hang Fully Blocked", "App Hang Non Fully Blocked"),
        # "Hang" vs "Hanging", from differing SDK versions
        ("App Hanging", "App Hang Fully Blocked"),
        ("Fatal App Hanging", "Fatal App Hang Fully Blocked"),
    ],
    ids=str,
)
def test_accepts_app_hang_differences_other_than_fatality(
    event_type: str, parent_type: str
) -> None:
    reason = classify_exception_type_mismatch(event_type, parent_type, "cocoa")

    assert reason == MismatchReason.APP_HANG_OTHER
    assert reason not in REJECTING_REASONS


def test_app_hang_check_is_case_insensitive() -> None:
    reason = classify_exception_type_mismatch(
        "FATAL APP HANG FULLY BLOCKED", "app hang fully blocked", "cocoa"
    )

    assert reason == MismatchReason.APP_HANG_FATALITY


def test_app_hang_check_ignores_platform() -> None:
    # Unlike the type-name comparison, fatality is meaningful on any platform.
    reason = classify_exception_type_mismatch(
        "Fatal App Hang Fully Blocked", "App Hang Fully Blocked", "javascript"
    )

    assert reason == MismatchReason.APP_HANG_FATALITY


def test_type_merely_starting_with_app_hang_words_is_not_a_hang() -> None:
    reason = classify_exception_type_mismatch("AppHangaroo", "AppHangaloo", "python")

    assert reason == MismatchReason.DISTINCT_TYPE_NAMES


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        ("ValueError", "TypeError"),
        ("OSError", "IOError"),
        ("RestClient::BadRequest", "RestClient::NotFound"),
        # Digits that don't parameterize, because they're mid-token
        ("Error1234", "Error5678"),
        ("HTTP404", "HTTP500"),
        ("Timeout30s", "Timeout60s"),
    ],
    ids=str,
)
def test_rejects_distinct_stable_type_names(event_type: str, parent_type: str) -> None:
    reason = classify_exception_type_mismatch(event_type, parent_type, "python")

    assert reason == MismatchReason.DISTINCT_TYPE_NAMES
    assert reason in REJECTING_REASONS


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        # Runtime-generated JVM lambda and anonymous class names
        (
            "com.example.Foo$$Lambda$14/0x00000008000c1440",
            "com.example.Foo$$Lambda$27/0x00000008000d9920",
        ),
        ("Module$$Anonymous$a1b2c3", "Module$$Anonymous$d4e5f6"),
        # Embedded hex / ints / IDs
        ("Error_a3f2b1", "Error_c9d4e7"),
        ("Chunk_12", "Chunk_34"),
        ("ErrorCode0x1F3A", "ErrorCode0x2B4C"),
        ("Err-3f8a9c2b1d4e5f6a", "Err-9b2c4d6e8f0a1b3c"),
    ],
    ids=str,
)
def test_accepts_types_differing_only_in_variable_data(event_type: str, parent_type: str) -> None:
    reason = classify_exception_type_mismatch(event_type, parent_type, "python")

    assert reason == MismatchReason.PARAMETERIZES_EQUAL
    assert reason not in REJECTING_REASONS


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        # Messages stuffed into the `type` field, differing by a severity prefix or an appended
        # value
        ("Fatal error in worker", "Error in worker"),
        ("Error: Get Order Delivery", "Error: Get Order Refund"),
        # Only one side needs whitespace
        ("SomeError: it broke", "SomeError"),
    ],
    ids=str,
)
def test_accepts_types_containing_whitespace(event_type: str, parent_type: str) -> None:
    reason = classify_exception_type_mismatch(event_type, parent_type, "python")

    assert reason == MismatchReason.CONTAINS_WHITESPACE
    assert reason not in REJECTING_REASONS


@pytest.mark.parametrize("platform", ["javascript", "node", "cocoa", "android", None, "other"])
def test_accepts_distinct_type_names_on_unstable_platforms(platform: str | None) -> None:
    reason = classify_exception_type_mismatch("V", "bm", platform)

    assert reason == MismatchReason.UNSTABLE_PLATFORM
    assert reason not in REJECTING_REASONS


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        # Obfuscated class names, which can differ build to build without the underlying class
        # changing
        ("g$a", "bm$c"),
        # Even fully-qualified names are only meaningful with a mapping applied
        ("java.lang.NullPointerException", "java.lang.IllegalStateException"),
    ],
    ids=str,
)
def test_accepts_distinct_type_names_on_java(event_type: str, parent_type: str) -> None:
    # Android events come through as `java`, and their types stay obfuscated when no ProGuard/R8
    # mapping has been applied.
    reason = classify_exception_type_mismatch(event_type, parent_type, "java")

    assert reason == MismatchReason.UNSTABLE_PLATFORM
    assert reason not in REJECTING_REASONS


@pytest.mark.parametrize(
    "event_type,parent_type",
    [
        ("Error", "ValueError"),
        ("ValueError", "Error"),
    ],
    ids=str,
)
def test_accepts_when_either_type_is_the_generic_placeholder(
    event_type: str, parent_type: str
) -> None:
    # "Error" is what a *missing* type gets defaulted to, so it isn't a real difference.
    reason = classify_exception_type_mismatch(event_type, parent_type, "python")

    assert reason == MismatchReason.GENERIC_PLACEHOLDER
    assert reason not in REJECTING_REASONS


def test_generic_placeholder_check_is_exact() -> None:
    # "Error" is only a placeholder on its own; a type that merely contains it is a real name.
    reason = classify_exception_type_mismatch("ErrorLike", "Errors", "python")

    assert reason == MismatchReason.DISTINCT_TYPE_NAMES
