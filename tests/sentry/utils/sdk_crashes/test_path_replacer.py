import pytest

from sentry.utils.sdk_crashes.path_replacer import (
    FixedPathReplacer,
    KeepAfterPatternMatchPathReplacer,
)


@pytest.mark.parametrize("path", ["path", "another"])
def test_fixed_path_replacer(path):
    fixed_path_replacer = FixedPathReplacer(path="fixed_path")

    assert fixed_path_replacer.replace_path(path=path) == "fixed_path"


@pytest.mark.parametrize(
    "patterns,path,expected_path",
    [
        (
            {r"\/sentry-react-native\/.*"},
            "Users/sentry/git-repos/sentry-react-native/dist/js/integrations/reactnative",
            "/sentry-react-native/dist/js/integrations/reactnative",
        ),
        (
            {r"\/sentry-react-native\/.*"},
            "Users/sentry/git-repos/sentry-react-natives/dist/js/integrations/reactnative",
            "fallback_path",
        ),
        (
            {r"\/sentry-react-native\/.*", r"\/gitrepos\/.*"},
            "Users/sentry/git-repos/sentry-react-native/dist/js/integrations/reactnative",
            "/sentry-react-native/dist/js/integrations/reactnative",
        ),
    ],
    ids=[
        "pattern_matches_path",
        "no_match_returns_fallback_path",
        "multiple_patterns_one_matches_path",
    ],
)
def test_keep_after_pattern(patterns, path, expected_path):
    path_replacer = KeepAfterPatternMatchPathReplacer(
        patterns=patterns, fallback_path="fallback_path"
    )

    assert path_replacer.replace_path(path=path) == expected_path
