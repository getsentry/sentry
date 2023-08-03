import pytest

from sentry.runner.commands.presenters.presenterdelegator import PresenterDelegator


class TestPresenterDelegator:
    """
    Tests for checking implementation of the presenter delegator.
    Formatting of the console is tested in test_configoptions.
    """

    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.presenterDelagator = PresenterDelegator()

    def test_valid_attribute(self):
        self.presenterDelagator.set("key", "val")
        self.presenterDelagator.unset("key")
        self.presenterDelagator.update("key", "db_val", "val")
        self.presenterDelagator.channel_update("key")
        self.presenterDelagator.drift("key", "val")
        self.presenterDelagator.error("key", "error msg")
        self.presenterDelagator.unregistered("key")
        self.presenterDelagator.invalid_type("key", "got_type", "expected_type")
        self.presenterDelagator.flush()

    def test_invalid_attribute(self):
        with pytest.raises(AttributeError):
            self.presenterDelagator.random()
        with pytest.raises(TypeError):
            self.presenterDelagator.update("key")
        with pytest.raises(TypeError):
            self.presenterDelagator.update("key", "value")
        with pytest.raises(TypeError):
            self.presenterDelagator.set("key")
        with pytest.raises(TypeError):
            self.presenterDelagator.unset("key", "value")
        with pytest.raises(TypeError):
            self.presenterDelagator.update("key")
        with pytest.raises(TypeError):
            self.presenterDelagator.update("key", "val")
        with pytest.raises(TypeError):
            self.presenterDelagator.channel_update()
        with pytest.raises(TypeError):
            self.presenterDelagator.drift("key")
        with pytest.raises(TypeError):
            self.presenterDelagator.error("key")
        with pytest.raises(TypeError):
            self.presenterDelagator.unregistered("key", "val")
