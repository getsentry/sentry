from unittest.mock import patch

import pytest

from sentry.runner.commands.presenters.presenterdelegator import PresenterDelegator


class TestPresenterDelegator:
    """
    Tests for checking implementation of the presenter delegator.
    Formatting of the console is tested in test_configoptions.
    """

    @pytest.fixture(autouse=True)
    @patch("sentry.runner.commands.presenters.slackpresenter.SLACK_WEBHOOK_URL", "https://test/")
    def setup(self) -> None:
        self.presenterDelagator = PresenterDelegator()

    def test_contains_attributes(self):
        expected_methods = [
            "set",
            "unset",
            "update",
            "channel_update",
            "drift",
            "error",
            "unregistered",
            "invalid_type",
            "flush",
        ]

        for method_name in expected_methods:
            assert hasattr(self.presenterDelagator, method_name)
