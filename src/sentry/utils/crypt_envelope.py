"""Envelope encryption module.

Envelope encryption requires an encryption hierarchy and multiple storage layers for differing
key types. First, data is encrypted using some data-encryption-key. Second, the data-encryption-key
is encrypted with the key-encryption-key. Third, the encrypted data and encrypted
data-encryption-key can be safely stored in the location of the implementers choosing. The
key-encryption-key must be stored in a safe, secondary location. Google KMS is the recommended
storage location for key-encryption-keys.

This module should not be used if your product requires fine-grained control over data-encryption-
-key generation or the encryption algorithm used.
"""
import io
from typing import Tuple

from sentry.utils.crypt import decrypt, encrypt, generate_key


def envelope_encrypt(key_encryption_key: bytes, value: bytes) -> Tuple[bytes, bytes]:
    """Return a tuple of an encrypted data-encryption-key and encrypted blob data.

    :param key_encryption_key: The key used to encrypt the data-encryption-key.
    :param value: The blob to be encrypted.
    """
    # Keys are randomly (and securely) generated every time a blob is encrypted. The purpose is to
    # abstract away responsibility from the implementer. If you have a need to use your own key
    # then you should not use this module.
    data_encryption_key = generate_key()

    # You don't need to know what nonce and tag are. Just be aware that the third item in this
    # tuple is the data you encrypted. Nonce and tag are only useful for decrypting it.
    #
    # Nonce and tag are stored as the first 32 bytes of the blob. This means we don't need to
    # store them as columns in the database. We might have done the same with the key, however,
    # because we want to support fast delete operations by removing all references to the
    # encryption key _without_ modifying the blob this rules that option out.
    nonce, tag, encrypted_data = encrypt(data_encryption_key, value)
    out_bytes = nonce + tag + encrypted_data

    # After encrypting the payload we encrypt our data-encryption-key. We do this because we don't
    # want to store it in plaintext. If the storage location is compromised an attacker  will still
    # need to retrieve our key-encryption-key before they can read the contents of a blob.
    nonce, tag, encrypted_dek = encrypt(key_encryption_key, data_encryption_key)
    out_key = nonce + tag + encrypted_dek

    return (out_key, out_bytes)


def envelope_decrypt(
    key_encryption_key: bytes,
    data_encryption_key: bytes,
    encrypted_value: bytes,
) -> bytes:
    """Return a decrypted blob of binary data.

    :param key_encryption_key: The key used to encrypt the data-encryption-key.
    :param data_encryption_key: The encrypted key used to encrypt the encrypted_value parameter.
    :param encrypted_value: The encrypted value of the blob.
    """
    # The data-encryption-key is encrypted and must be decrypted with the key-encryption-key before
    # decrypting the blob.
    nonce, tag, encrypted_dek = _split(data_encryption_key)
    dek = decrypt(key_encryption_key, nonce, tag, encrypted_dek)

    # With the DEK decrypted we can now decrypt the blob data.
    nonce, tag, encrypted_blob = _split(encrypted_value)
    return decrypt(dek, nonce, tag, encrypted_blob)


def rotate_data_encryption_key(
    key_encryption_key: bytes,
    data_encryption_key: bytes,
    encrypted_value: bytes,
) -> Tuple[bytes, bytes]:
    """Rotates the data-encryption-key.

    Data encrypted with a vulnerable DEK must be re-encrypted with a new DEK. Because the KEK is
    still valid we re-use it.

    :param key_encryption_key: The key used to encrypt the data-encryption-key.
    :param data_encryption_key: The encrypted key used to encrypt the encrypted_value parameter.
    :param encrypted_value: The encrypted value of the blob.
    """
    decrypted_blob = envelope_decrypt(key_encryption_key, data_encryption_key, encrypted_value)
    return envelope_encrypt(key_encryption_key, decrypted_blob)


def rotate_key_encryption_key(
    old_key_encryption_key: bytes,
    new_key_encryption_key: bytes,
    data_encryption_key: bytes,
) -> bytes:
    """Rotates the key-encryption-key.

    If a KEK is compromised then every encrypted DEK is vulnerable. We must decrypt each DEK with
    the old KEK before encrypting with a new, secure KEK.

    :param old_key_encryption_key: The vulnerable key previously used to encrypt the DEK.
    :param new_key_encryption_key: The replacement key used to encrypt the DEK.
    :param data_encryption_key: The DEK responsible for decrypting blob data.
    """
    nonce, tag, encrypted_dek = _split(data_encryption_key)
    dek = decrypt(old_key_encryption_key, nonce, tag, encrypted_dek)
    nonce, tag, message = encrypt(new_key_encryption_key, dek)
    return nonce + tag + message


def _split(encrypted_message: bytes) -> Tuple[bytes, bytes, bytes]:
    # Nonce and tag are the first 32 bytes by convention (see: "envelope_encrypt"). Whatever is left
    # must be the encrypted message. If the data was malformed then the decryption step will fail
    # and an exception will be raised.
    bytesio = io.BytesIO(encrypted_message)
    return (bytesio.read(16), bytesio.read(16), bytesio.read())
