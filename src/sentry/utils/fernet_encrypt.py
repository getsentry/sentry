"""
Simple symmetric encryption utilities
"""

from typing import Any, Dict, List, Union

from cryptography.fernet import Fernet

from sentry.utils import json

# anything that can be converted to and from JSON
IntoJsonObject = Union[str, int, float, List[Any], Dict[Any, Any], None]


def encrypt_object(obj: IntoJsonObject, key: str) -> str:
    """
    Encrypts an object using the given key.

    Takes an object that can be deserialized in json
    converts it to json a json string, than to a byte array.
    It then encrypts it using the key (transformed from string to
    bytes), finally the encrypted result ( which is a base64 string
    as a byte array) is converted into a string (which should leave
    the content unchanged as it is base64).
    """
    key = key.encode("utf-8")
    try:
        f = Fernet(key)
    except Exception as e:  # NOQA
        raise ValueError("Invalid encryption key") from e
    json_str = json.dumps(obj)
    json_bytes = json_str.encode("utf-8")
    encrypted_bytes = f.encrypt(json_bytes)
    return encrypted_bytes.decode()


def decrypt_object(encrypted: str, key: str) -> IntoJsonObject:
    """
    Decrypts an object using the given key.

    Takes a string representing an encrypted json object and using
    a key decrypts it into an object
    """
    key = key.encode("utf-8")
    try:
        f = Fernet(key)
    except Exception as e:  # NOQA
        raise ValueError("Invalid encryption Key") from e
    encrypted = encrypted.encode("utf-8")
    decrypted_bytes = f.decrypt(encrypted)
    return json.loads(decrypted_bytes)
