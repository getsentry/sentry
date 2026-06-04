from typing import Literal, TypedDict


class EncryptedFieldSettings(TypedDict):
    method: Literal["fernet"] | Literal["plaintext"]
    # fernet config
    fernet_primary_key_id: str | None
    fernet_keys_location: str | None
