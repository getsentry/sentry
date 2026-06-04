import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from sentry.utils.security.encrypted_field_key_store import FernetKeyStore


@pytest.fixture(autouse=True)
def reset_key_store() -> Generator[None]:
    """Reset the FernetKeyStore state before each test."""
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    FernetKeyStore._keys = {}
    FernetKeyStore._is_loaded = False

    yield

    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


@pytest.fixture
def temp_keys_dir() -> Generator[Path]:
    """Create a temporary directory for key files."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def valid_fernet_key() -> bytes:
    """Generate a valid Fernet key."""
    return Fernet.generate_key()


@pytest.fixture
def fernet_keys_store(valid_fernet_key: bytes) -> Generator[tuple[str, bytes]]:
    """Single key for testing. Mocks the FernetKeyStore._keys attribute."""
    key_id = "key_id_1"
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = {key_id: Fernet(valid_fernet_key)}
    FernetKeyStore._is_loaded = True

    yield key_id, valid_fernet_key

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


@pytest.fixture
def multi_fernet_keys_store() -> Generator[dict[str, bytes]]:
    """Multiple keys for testing key rotation. Mocks the FernetKeyStore._keys attribute."""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    key3 = Fernet.generate_key()
    keys_dict = {
        "key_primary": Fernet(key1),
        "key_secondary": Fernet(key2),
        "key_tertiary": Fernet(key3),
    }

    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = keys_dict
    FernetKeyStore._is_loaded = True

    yield {"key_primary": key1, "key_secondary": key2, "key_tertiary": key3}

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


class TestPathToKeys:
    def test_path_to_keys_with_valid_path(self) -> None:
        """Test _path_to_keys returns Path when settings configured."""
        test_path = "/path/to/keys"
        with override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": test_path}):
            result = FernetKeyStore._path_to_keys()
            assert result == Path(test_path)
            assert isinstance(result, Path)

    def test_path_to_keys_with_none(self) -> None:
        """Test _path_to_keys returns None when no path configured."""
        with override_settings(DATABASE_ENCRYPTION_SETTINGS={}):
            result = FernetKeyStore._path_to_keys()
            assert result is None


class TestLoadKeys:
    def test_load_keys_no_path_configured(self) -> None:
        """Test load_keys when no keys directory is configured."""
        with override_settings(DATABASE_ENCRYPTION_SETTINGS={}):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is None
            assert FernetKeyStore._is_loaded is True

    def test_load_keys_directory_not_exists(self, tmp_path: Path) -> None:
        """Test load_keys raises error when directory doesn't exist."""
        non_existent_path = tmp_path / "non_existent"

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(non_existent_path)}
        ):
            with pytest.raises(ImproperlyConfigured, match="Key directory not found"):
                FernetKeyStore.load_keys()

    def test_load_keys_path_is_file_not_directory(self, tmp_path: Path) -> None:
        """Test load_keys raises error when path is a file, not a directory."""
        file_path = tmp_path / "keyfile.txt"
        file_path.write_text("not a directory")

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(file_path)}
        ):
            with pytest.raises(ImproperlyConfigured, match="Key directory not found"):
                FernetKeyStore.load_keys()

    def test_load_keys_empty_directory(self, temp_keys_dir: Path) -> None:
        """Test load_keys with empty directory."""
        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert FernetKeyStore._keys == {}
            assert FernetKeyStore._is_loaded is True

    def test_load_keys_single_valid_key(self, temp_keys_dir: Path, valid_fernet_key: bytes) -> None:
        """Test load_keys with a single valid key file."""
        key_file = temp_keys_dir / "key_1"
        key_file.write_text(valid_fernet_key.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "key_1" in FernetKeyStore._keys
            assert isinstance(FernetKeyStore._keys["key_1"], Fernet)
            assert FernetKeyStore._is_loaded is True

    def test_load_keys_multiple_valid_keys(self, temp_keys_dir: Path) -> None:
        """Test load_keys with multiple valid key files."""
        key1 = Fernet.generate_key()
        key2 = Fernet.generate_key()
        key3 = Fernet.generate_key()

        (temp_keys_dir / "primary_key").write_text(key1.decode("utf-8"))
        (temp_keys_dir / "secondary_key").write_text(key2.decode("utf-8"))
        (temp_keys_dir / "tertiary_key").write_text(key3.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 3
            assert "primary_key" in FernetKeyStore._keys
            assert "secondary_key" in FernetKeyStore._keys
            assert "tertiary_key" in FernetKeyStore._keys
            assert FernetKeyStore._is_loaded is True

    def test_load_keys_skips_hidden_files(
        self, temp_keys_dir: Path, valid_fernet_key: bytes
    ) -> None:
        """Test load_keys skips hidden files (starting with .)."""
        visible_key = temp_keys_dir / "visible_key"
        hidden_key = temp_keys_dir / ".hidden_key"

        visible_key.write_text(valid_fernet_key.decode("utf-8"))
        hidden_key.write_text(valid_fernet_key.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "visible_key" in FernetKeyStore._keys
            assert ".hidden_key" not in FernetKeyStore._keys

    def test_load_keys_skips_subdirectories(
        self, temp_keys_dir: Path, valid_fernet_key: bytes
    ) -> None:
        """Test load_keys ignores subdirectories."""
        key_file = temp_keys_dir / "key_1"
        key_file.write_text(valid_fernet_key.decode("utf-8"))

        # Create a subdirectory
        subdir = temp_keys_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested_key").write_text(valid_fernet_key.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "key_1" in FernetKeyStore._keys
            assert "subdir" not in FernetKeyStore._keys

    def test_load_keys_empty_file_skipped(
        self, temp_keys_dir: Path, valid_fernet_key: bytes
    ) -> None:
        """Test load_keys skips empty key files."""
        valid_key_file = temp_keys_dir / "valid_key"
        empty_key_file = temp_keys_dir / "empty_key"
        whitespace_key_file = temp_keys_dir / "whitespace_key"

        valid_key_file.write_text(valid_fernet_key.decode("utf-8"))
        empty_key_file.write_text("")
        whitespace_key_file.write_text("   \n  \t  ")

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            # Only valid key should be loaded, empty files are skipped
            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "valid_key" in FernetKeyStore._keys
            assert "empty_key" not in FernetKeyStore._keys
            assert "whitespace_key" not in FernetKeyStore._keys

    def test_load_keys_invalid_fernet_key(
        self, temp_keys_dir: Path, valid_fernet_key: bytes
    ) -> None:
        """Test load_keys handles invalid Fernet keys gracefully."""
        valid_key_file = temp_keys_dir / "valid_key"
        invalid_key_file = temp_keys_dir / "invalid_key"

        valid_key_file.write_text(valid_fernet_key.decode("utf-8"))
        invalid_key_file.write_text("this-is-not-a-valid-fernet-key")

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            # Only valid key should be loaded, invalid key is skipped
            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "valid_key" in FernetKeyStore._keys
            assert "invalid_key" not in FernetKeyStore._keys

    def test_load_keys_with_newlines_and_whitespace(self, temp_keys_dir: Path) -> None:
        """Test load_keys strips whitespace from key content."""
        key = Fernet.generate_key()
        key_file = temp_keys_dir / "key_with_whitespace"
        key_file.write_text(f"  {key.decode('utf-8')}  \n\n")

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            FernetKeyStore.load_keys()

            assert FernetKeyStore._keys is not None
            assert len(FernetKeyStore._keys) == 1
            assert "key_with_whitespace" in FernetKeyStore._keys


class TestGetFernetForKeyId:
    def test_get_fernet_for_key_id_auto_loads_keys(
        self, temp_keys_dir: Path, valid_fernet_key: bytes
    ) -> None:
        """Test get_fernet_for_key_id auto-loads keys on first access."""
        key_file = temp_keys_dir / "auto_load_key"
        key_file.write_text(valid_fernet_key.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={"fernet_keys_location": str(temp_keys_dir)}
        ):
            # Keys not loaded yet
            assert FernetKeyStore._is_loaded is False

            fernet = FernetKeyStore.get_fernet_for_key_id("auto_load_key")

            # Should have auto-loaded
            assert FernetKeyStore._is_loaded is True
            assert isinstance(fernet, Fernet)  # type: ignore[unreachable]

    def test_get_fernet_for_key_id_returns_fernet_instance(
        self, fernet_keys_store: tuple[str, bytes]
    ) -> None:
        """Test get_fernet_for_key_id returns Fernet instance for valid key_id."""
        key_id, _fernet_key = fernet_keys_store

        fernet = FernetKeyStore.get_fernet_for_key_id(key_id)
        assert isinstance(fernet, Fernet)

    def test_get_fernet_for_key_id_raises_when_keys_none(self) -> None:
        """Test get_fernet_for_key_id raises error when keys are None (misconfigured)."""
        # Simulate no keys directory configured
        FernetKeyStore._keys = None
        FernetKeyStore._is_loaded = True

        with pytest.raises(ValueError, match="Fernet encryption keys are not loaded"):
            FernetKeyStore.get_fernet_for_key_id("any_key")

    def test_get_fernet_for_key_id_raises_when_key_not_found(
        self, fernet_keys_store: tuple[str, bytes]
    ) -> None:
        """Test get_fernet_for_key_id raises error when key_id doesn't exist."""
        _key_id, _fernet_key = fernet_keys_store

        with pytest.raises(ValueError, match="Encryption key with ID 'missing_key' not found"):
            FernetKeyStore.get_fernet_for_key_id("missing_key")


class TestGetPrimaryFernet:
    def test_get_primary_fernet_returns_tuple(self, fernet_keys_store: tuple[str, bytes]) -> None:
        """Test get_primary_fernet returns (key_id, Fernet) tuple."""
        key_id, _fernet_key = fernet_keys_store

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={
                "fernet_primary_key_id": key_id,
            }
        ):
            returned_key_id, fernet = FernetKeyStore.get_primary_fernet()

            assert returned_key_id == key_id

    def test_get_primary_fernet_raises_when_not_configured(self) -> None:
        """Test get_primary_fernet raises error when primary key ID not configured."""
        with override_settings(DATABASE_ENCRYPTION_SETTINGS={}):
            with pytest.raises(ValueError, match="Fernet primary key ID is not configured"):
                FernetKeyStore.get_primary_fernet()

    def test_get_primary_fernet_raises_when_key_not_found(
        self, fernet_keys_store: tuple[str, bytes]
    ) -> None:
        """Test get_primary_fernet raises error when primary key doesn't exist."""
        _key_id, _fernet_key = fernet_keys_store

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={
                "fernet_primary_key_id": "nonexistent_primary",
            }
        ):
            with pytest.raises(
                ValueError, match="Encryption key with ID 'nonexistent_primary' not found"
            ):
                FernetKeyStore.get_primary_fernet()

    def test_get_primary_fernet_with_multiple_keys(
        self, multi_fernet_keys_store: dict[str, bytes]
    ) -> None:
        """Test get_primary_fernet returns correct key when multiple keys exist."""

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={
                "fernet_primary_key_id": "key_secondary",
            }
        ):
            key_id, fernet = FernetKeyStore.get_primary_fernet()

            assert key_id == "key_secondary"
            assert isinstance(fernet, Fernet)

    def test_get_primary_fernet_auto_loads_if_needed(self, temp_keys_dir: Path) -> None:
        """Test get_primary_fernet auto-loads keys if not already loaded."""
        key = Fernet.generate_key()
        (temp_keys_dir / "primary").write_text(key.decode("utf-8"))

        with override_settings(
            DATABASE_ENCRYPTION_SETTINGS={
                "fernet_keys_location": str(temp_keys_dir),
                "fernet_primary_key_id": "primary",
            }
        ):
            # Keys not loaded yet
            assert FernetKeyStore._is_loaded is False

            key_id, fernet = FernetKeyStore.get_primary_fernet()

            # Should have auto-loaded
            assert FernetKeyStore._is_loaded is True
            assert key_id == "primary"  # type: ignore[unreachable]
            assert isinstance(fernet, Fernet)
