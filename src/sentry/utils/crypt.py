from typing import Tuple

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes


def decrypt(key: bytes, nonce: bytes, tag: bytes, encrypted_value: bytes) -> bytes:
    cipher = AES.new(key, AES.MODE_EAX, nonce)
    return cipher.decrypt_and_verify(encrypted_value, tag)


def encrypt(key: bytes, value: bytes) -> Tuple[bytes, bytes, bytes]:
    cipher = AES.new(key, AES.MODE_EAX)
    encrypted_value, tag = cipher.encrypt_and_digest(value)
    return (cipher.nonce, tag, encrypted_value)


def rotate(
    old_key: bytes,
    new_key: bytes,
    nonce: bytes,
    tag: bytes,
    encrypted_value: bytes,
) -> bytes:
    decrypted_value = decrypt(old_key, nonce, tag, encrypted_value)
    return encrypt(new_key, decrypted_value)


def generate_key() -> bytes:
    """The key length implictly defines our AES encryption as 128 bit."""
    return get_random_bytes(16)
