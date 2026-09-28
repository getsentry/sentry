import pytest

from flagpole.conditions import glob_star_match


@pytest.mark.parametrize(
    ("pattern", "value", "expected"),
    [
        ("sentry", "sentry", True),
        ("sentry", "getsentry", False),
        ("jayonb*", "jayonb73", True),
        ("jayonb*", "jayonb", True),
        ("jayonb*", "dangoldonb1", False),
        ("*@sentry.io", "user@sentry.io", True),
        ("*@sentry.io", "user@example.com", False),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding70@sentry.io", True),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding@sentry.io", True),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding70@example.com", False),
        ("a*b*c", "abc", True),
        ("a*b*c", "aXXbYYc", True),
        ("a*b*c", "aXXc", False),
        ("a**b", "ab", True),
        ("*", "anything", True),
        ("*", "", True),
        ("JAYONB*", "jayonb73", True),
        ("jayonb*", "JAYONB73", True),
        # The prefix and suffix anchors may not overlap.
        ("a*a", "a", False),
        ("a*a", "aa", True),
        ("ab*ab", "ab", False),
        ("ab*ab", "abab", True),
        # Only '*' is a wildcard.
        ("a?c", "abc", False),
        ("a?c", "a?c", True),
        ("[ab]", "a", False),
    ],
)
def test_glob_star_match(pattern: str, value: str, expected: bool) -> None:
    assert glob_star_match(pattern, value) is expected
