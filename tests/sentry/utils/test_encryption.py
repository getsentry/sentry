from unittest import TestCase

from cryptography.fernet import Fernet

from sentry.utils.encryption import MARKER, EncryptionManager


class EncryptionManagerTest(TestCase):
    def test_simple(self):
        manager = EncryptionManager(
            schemes=(("1", Fernet("J5NxyG0w1OyZEDdEOX0Nyv2upm5H3J35rTEb1jEiVbs=")),)
        )
        value = manager.encrypt("hello world")
        assert value.startswith(f"{MARKER}1$")
        result = manager.decrypt(value)
        assert result == "hello world"

        manager = EncryptionManager(
            schemes=(
                ("2", Fernet(Fernet.generate_key())),
                ("1", Fernet("J5NxyG0w1OyZEDdEOX0Nyv2upm5H3J35rTEb1jEiVbs=")),
            )
        )

        # this should use the first scheme
        result = manager.decrypt(value)
        assert result == "hello world"

        value2 = manager.encrypt("hello world")
        assert value2 != value
        assert value2.startswith(f"{MARKER}2$")

    def test_no_schemes(self):
        manager = EncryptionManager(schemes=())
        value = manager.encrypt("hello world")
        assert value == "hello world"
        result = manager.decrypt(value)
        assert result == "hello world"
