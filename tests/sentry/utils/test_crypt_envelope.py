import pytest

from sentry.utils.crypt import generate_key
from sentry.utils.crypt_envelope import (
    envelope_decrypt,
    envelope_encrypt,
    rotate_data_encryption_key,
    rotate_key_encryption_key,
)


def test_envelope_encrypt():
    # Assert envelope_encrypt returns two values. One is the data encryption key, the other is
    # the encrypted message.
    dek, result = envelope_encrypt(generate_key(), b"hello, world")
    assert isinstance(dek, bytes)
    assert isinstance(result, bytes)
    assert result != b"hello, world"


def test_envelope_encrypt_invalid_key():
    # Key must be 16 bytes.
    assert pytest.raises(ValueError, envelope_encrypt, b"123", b"hello, world")


def test_envelope_decrypt():
    # Assert a valid kek, dek, encrypted message triple can be decrypted successfully.
    kek = generate_key()
    dek, result = envelope_encrypt(kek, b"hello, world")

    result = envelope_decrypt(kek, dek, result)
    assert result == b"hello, world"


def test_envelope_decrypt_wrong_kek():
    # Assert incorrect keks can not be used to decrypt a message.
    dek, result = envelope_encrypt(generate_key(), b"hello, world")
    assert pytest.raises(ValueError, envelope_decrypt, generate_key(), dek, result)


def test_envelope_decrypt_wrong_dek():
    # Assert incorrect deks can not be used to decrypt a message.
    kek = generate_key()
    _, result = envelope_encrypt(kek, b"hello, world")
    assert pytest.raises(ValueError, envelope_decrypt, kek, generate_key(), result)


def test_envelope_decrypt_invalid_kek():
    # Assert invalid deks can not be used to decrypt a message.
    dek, result = envelope_encrypt(generate_key(), b"hello, world")
    assert pytest.raises(ValueError, envelope_decrypt, b"123", dek, result)


def test_envelope_decrypt_invalid_dek():
    # Assert invalid deks can not be used to decrypt a message.
    kek = generate_key()
    _, result = envelope_encrypt(kek, b"hello, world")
    assert pytest.raises(ValueError, envelope_decrypt, kek, b"123", result)


def test_rotate_data_encryption_key():
    kek = generate_key()
    old_dek, old_message = envelope_encrypt(kek, b"hello, world")

    new_dek, new_message = rotate_data_encryption_key(kek, old_dek, old_message)
    result = envelope_decrypt(kek, new_dek, new_message)
    assert result == b"hello, world"

    # Assert the old_dek can not be used to decrypt the new message.
    assert pytest.raises(ValueError, envelope_decrypt, kek, old_dek, new_message)


def test_rotate_key_encryption_key():
    old_kek = generate_key()
    old_dek, encrypted_message = envelope_encrypt(old_kek, b"hello, world")

    # Assert old_kek, old_dek pair can decrypt the message.
    result = envelope_decrypt(old_kek, old_dek, encrypted_message)
    assert result == b"hello, world"

    new_kek = generate_key()
    new_dek = rotate_key_encryption_key(old_kek, new_kek, old_dek)

    # Assert the new_kek, new_dek pair can decrypt the message.
    result = envelope_decrypt(new_kek, new_dek, encrypted_message)
    assert result == b"hello, world"
