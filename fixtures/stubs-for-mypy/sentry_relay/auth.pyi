import json
from collections.abc import Callable
from typing import Any

from sentry_relay.utils import RustObject

class PublicKey(RustObject):
    @classmethod
    def parse(cls, string: str) -> PublicKey: ...
    def verify(self, buf: bytes, sig: str, max_age: int | None = None) -> bool: ...
    def unpack(
        self,
        buf: bytes,
        sig: str,
        max_age: int | None = None,
        json_loads: Callable[[str | bytes], Any] = json.loads,
    ) -> Any: ...

class SecretKey(RustObject):
    @classmethod
    def parse(cls, string: str) -> SecretKey: ...
    def sign(self, value: bytes) -> str: ...
    def pack(self, data: Any) -> tuple[bytes, str]: ...

def generate_key_pair() -> tuple[SecretKey, PublicKey]: ...
def generate_relay_id() -> Any: ...
def create_register_challenge(
    data: bytes,
    signature: str,
    secret: str,
    max_age: int = 60,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
def validate_register_response(
    data: bytes,
    signature: str,
    secret: str,
    max_age: int = 60,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
def is_version_supported(version: str | None) -> bool: ...
