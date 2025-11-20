from logging import getLogger
from pathlib import Path

import sentry_sdk
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = getLogger(__name__)


class FernetKeyStore:
    _keys: dict[str, Fernet] | None = {}
    _is_loaded = False

    @classmethod
    def _path_to_keys(cls) -> Path | None:
        settings_path = settings.DATABASE_ENCRYPTION_SETTINGS.get("fernet_keys_location")

        return Path(settings_path) if settings_path is not None else None

    @classmethod
    def load_keys(cls) -> None:
        """
        Reads all files in the given directory.
        Filename = Key ID
        File Content = Fernet Key
        """
        path = cls._path_to_keys()

        if path is None:
            # No keys directory is configured, so we don't need to load any keys.
            cls._keys = None
            cls._is_loaded = True
            return

        if not path.exists() or not path.is_dir():
            raise ImproperlyConfigured(f"Key directory not found: {path}")

        # Clear the keys dictionary to avoid stale data
        cls._keys = {}

        for file_path in path.iterdir():
            if file_path.is_file():
                # Skip hidden files
                if file_path.name.startswith("."):
                    continue

                try:
                    with open(file_path) as f:
                        key_content = f.read().strip()

                    if not key_content:
                        logger.warning("Empty key file found: %s", file_path.name)
                        continue

                    # Store Fernet object in the dictionary
                    # Objects are stored instead of keys for performance optimization.
                    cls._keys[file_path.name] = Fernet(key_content.encode("utf-8"))

                except Exception as e:
                    logger.exception("Error reading key %s", file_path.name)
                    sentry_sdk.capture_exception(e)

        cls._is_loaded = True
        if cls._keys:
            logger.info("Successfully loaded %d Fernet encryption keys.", len(cls._keys))
        else:
            logger.info("No Fernet encryption keys loaded.")

    @classmethod
    def get_fernet_for_key_id(cls, key_id: str) -> Fernet:
        """Retrieves a Fernet object for a specific key ID"""
        if not cls._is_loaded:
            # Fallback: if the keys are not already loaded, load them on first access.
            logger.warning("Loading Fernet encryption keys on first access instead of on startup.")
            cls.load_keys()

        if cls._keys is None:
            # This can happen only if the keys settings are misconfigured
            raise ValueError(
                "Fernet encryption keys are not loaded. Please configure the keys directory."
            )

        fernet = cls._keys.get(key_id)
        if not fernet:
            raise ValueError(f"Encryption key with ID '{key_id}' not found.")

        return fernet

    @classmethod
    def get_primary_fernet(cls) -> tuple[str, Fernet]:
        """
        Reads the configuration and returns the primary key ID and the Fernet object
        initialized with the primary Fernet key.

        The primary Fernet is the one that is used to encrypt the data, while
        decryption can be done with any of the registered Fernet keys.
        """

        primary_key_id = settings.DATABASE_ENCRYPTION_SETTINGS.get("fernet_primary_key_id")
        if primary_key_id is None:
            raise ValueError("Fernet primary key ID is not configured.")

        return primary_key_id, cls.get_fernet_for_key_id(primary_key_id)


def initialize_encrypted_field_key_store() -> None:
    # FernetKeyStore load keys from the mounted file system
    FernetKeyStore.load_keys()
