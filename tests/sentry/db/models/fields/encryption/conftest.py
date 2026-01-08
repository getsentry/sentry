import pytest
from cryptography.fernet import Fernet

from sentry.utils.security.encrypted_field_key_store import FernetKeyStore


@pytest.fixture
def fernet_key():
    return Fernet.generate_key()


@pytest.fixture
def fernet_instance(fernet_key):
    return Fernet(fernet_key)


@pytest.fixture
def fernet_keys_store(fernet_key):
    """Single key for testing. Mocks the FernetKeyStore._keys attribute."""
    key_id = "key_id_1"
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = {key_id: Fernet(fernet_key)}
    FernetKeyStore._is_loaded = True

    yield key_id, fernet_key

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


@pytest.fixture
def multi_fernet_keys_store():
    """Multiple keys for testing key rotation. Mocks the FernetKeyStore._keys attribute."""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    keys_dict = {
        "key_primary": Fernet(key1),
        "key_secondary": Fernet(key2),
    }

    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = keys_dict
    FernetKeyStore._is_loaded = True

    yield {"key_primary": key1, "key_secondary": key2}

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded
