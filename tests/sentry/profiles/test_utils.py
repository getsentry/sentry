import pytest

from sentry.profiles.utils import format_profile_function


@pytest.mark.parametrize(
    ["platform", "package", "function", "expected"],
    [
        pytest.param(
            "python",
            "sentry.nodestore.base",
            "NodeStorage._set_cache_item",
            "sentry.nodestore.base.NodeStorage._set_cache_item",
            id="python",
        ),
        pytest.param(
            "node",
            "node:async_hooks",
            "run",
            "node:async_hooks.run",
            id="node with package",
        ),
        pytest.param(
            "node",
            "",
            "run",
            "run",
            id="node without package",
        ),
        pytest.param(
            "android",
            "io.sentry.samples.android.databinding",
            "io.sentry.samples.android.databinding.ActivityMainBinding.inflate(android.view.LayoutInflater, android.view.ViewGroup, boolean): io.sentry.samples.android.databinding.ActivityMainBinding",
            "io.sentry.samples.android.databinding.ActivityMainBinding.inflate(android.view.LayoutInflater, android.view.ViewGroup, boolean): io.sentry.samples.android.databinding.ActivityMainBinding",
            id="android",
        ),
        pytest.param(
            "cocoa",
            "iOS-Swift",
            "PerformanceViewController.doRandomWork()",
            "PerformanceViewController.doRandomWork()",
            id="cocoa",
        ),
    ],
)
def test_format_profile_function(platform, package, function, expected):
    assert format_profile_function(platform, package, function) == expected
