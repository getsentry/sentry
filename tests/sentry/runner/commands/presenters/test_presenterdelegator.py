import pytest
import responses

from sentry.runner.commands.presenters.presenterdelegator import PresenterDelegator


class TestPresenterDelegator:

    """
    Tests for checking implementation of the presenter delegator.
    Formatting of the console is tested in test_configoptions.
    """

    @pytest.fixture(autouse=True)
    @responses.activate
    def setup(self) -> None:
        self.presenterDelagator = PresenterDelegator()

    def test_contains_attributes(self):
        expected_methods = [
            "set",
            "unset",
            "update",
            "channel_update",
            "drift",
            "unregistered",
            "invalid_type",
            "flush",
        ]

        for method_name in expected_methods:
            assert hasattr(self.presenterDelagator, method_name)
