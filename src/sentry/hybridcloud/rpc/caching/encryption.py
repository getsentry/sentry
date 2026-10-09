import base64
import logging
from abc import ABC, abstractmethod
from enum import StrEnum
from typing import NamedTuple

import sentry_sdk
from cryptography.fernet import InvalidToken

from sentry.utils import metrics
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

logger = logging.getLogger(__name__)

# Default prefix used by the silo cache callables. Matches the encrypted DB field
# namespace so the stored format is ``enc:<method>:...``.
CACHE_ENCRYPTION_PREFIX = "enc:"


class InvalidEncryptionMethod(Exception):
    pass


class InvalidEncodingError(ValueError):
    pass


class EncryptionMethod(StrEnum):
    PLAINTEXT = "plaintext"
    FERNET = "fernet"


class _ParsedValue(NamedTuple):
    method: EncryptionMethod
    key_id: str
    payload: str


class EncryptionStrategy(ABC):
    @abstractmethod
    def encrypt(self, value: bytes) -> tuple[bytes, str]:
        raise NotImplementedError

    @abstractmethod
    def decrypt(self, value: bytes, key_id: str) -> bytes:
        raise NotImplementedError


class FernetEncryptionStrategy(EncryptionStrategy):
    def encrypt(self, value: bytes) -> tuple[bytes, str]:
        key_id, fernet = FernetKeyStore.get_primary_fernet()
        token = fernet.encrypt(value)
        return token, key_id

    def decrypt(self, value: bytes, key_id: str) -> bytes:
        return FernetKeyStore.get_fernet_for_key_id(key_id).decrypt(value)


_HANDLERS: dict[EncryptionMethod, EncryptionStrategy] = {
    EncryptionMethod.FERNET: FernetEncryptionStrategy(),
}


class CacheEncrypter:
    """
    Encrypts and decrypts payloads, intended for use in our Django cache.

    Requires supplying the encryption method to use, but automatically detects
    the decryption method from the stored value.

    Based heavily on the EncryptedField implementation for our database columns,
    but simplified for the cache use case.
    """

    @staticmethod
    def encrypt(value: str, method: EncryptionMethod) -> str:
        """
        Encrypt ``value`` using the specified method. The encrypted value will be
        returned as an encrypted utf8 string prefixed with the encryption method
        and key id.
        """
        if method not in _HANDLERS:
            raise InvalidEncryptionMethod(f"Unsupported encryption method '{method}'")

        handler = _HANDLERS[method]
        tags = {"method": method}
        try:
            with metrics.timer("hybridcloud.caching.encrypt.duration", tags=tags):
                value_bytes = value.encode("utf-8")
                encrypted_bytes, key_id = handler.encrypt(value_bytes)
        except Exception:
            metrics.incr("hybridcloud.caching.encrypt", tags={**tags, "status": "failure"})
            raise

        metrics.incr("hybridcloud.caching.encrypt", tags={**tags, "status": "success"})
        encoded = base64.b64encode(encrypted_bytes).decode("utf-8")
        return f"{CACHE_ENCRYPTION_PREFIX}{method}:{key_id}:{encoded}"

    @staticmethod
    def decrypt(value: str) -> str:
        """
        Inverse of ``encrypt``.

        Raises ``InvalidEncryptionMethod`` if the value is not prefixed with a known
        method; use ``is_encrypted`` to check first. If the value is marked but cannot
        be decrypted, the original string is returned; callers surface that as a JSON
        decode failure and treat the entry as a cache miss. Raises
        ``InvalidEncodingError`` if the value decrypts but is not valid UTF-8.
        """
        parsed = CacheEncrypter._parse(value)
        handler = _HANDLERS[parsed.method]
        tags = {"method": parsed.method}
        try:
            with metrics.timer("hybridcloud.caching.decrypt.duration", tags=tags):
                decrypted = handler.decrypt(base64.b64decode(parsed.payload), parsed.key_id)
        except (InvalidToken, ValueError):
            # Expected data problems: ciphertext that fails authentication, corrupt
            # base64, or a key id this process does not have (e.g. after rotation).
            metrics.incr("hybridcloud.caching.decrypt", tags={**tags, "status": "failure"})
            return value
        except Exception as e:
            sentry_sdk.capture_exception(e)
            logger.exception("Failed to decrypt cache value with %s", parsed.method)
            metrics.incr("hybridcloud.caching.decrypt", tags={**tags, "status": "failure"})
            return value

        try:
            decoded = decrypted.decode("utf-8")
        except UnicodeDecodeError as e:
            metrics.incr("hybridcloud.caching.decrypt", tags={**tags, "status": "failure"})
            raise InvalidEncodingError("Decrypted cache value is not valid UTF-8") from e

        metrics.incr("hybridcloud.caching.decrypt", tags={**tags, "status": "success"})
        return decoded

    @staticmethod
    def _parse(value: str) -> _ParsedValue:
        if not value.startswith(CACHE_ENCRYPTION_PREFIX):
            raise InvalidEncryptionMethod("Invalid encryption prefix")

        method, _, rest = value[len(CACHE_ENCRYPTION_PREFIX) :].partition(":")
        if method not in _HANDLERS:
            raise InvalidEncryptionMethod(f"Unknown encryption method '{method}'")

        key_id, _, payload = rest.partition(":")
        return _ParsedValue(EncryptionMethod(method), key_id, payload)

    @staticmethod
    def is_encrypted(value: str) -> bool:
        try:
            CacheEncrypter._parse(value)
            return True
        except InvalidEncryptionMethod:
            return False
