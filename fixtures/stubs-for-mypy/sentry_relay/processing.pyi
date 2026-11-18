import json
from collections.abc import Callable, Mapping
from typing import Any

from sentry_relay.utils import RustObject

VALID_PLATFORMS: frozenset[str]

class GeoIpLookup(RustObject):
    @classmethod
    def from_path(cls, path: str) -> GeoIpLookup: ...

class StoreNormalizer(RustObject):
    def __new__(cls, **config: Any) -> StoreNormalizer: ...
    def normalize_event(
        self,
        event: Any = None,
        raw_event: Any = None,
        json_loads: Callable[[str | bytes], Any] = json.loads,
    ) -> dict[str, Any]: ...

def split_chunks(
    string: str,
    remarks: Mapping[str, Any],
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> list[str]: ...
def meta_with_chunks(data: Any, meta: Any) -> Any: ...
def parse_release(
    release: str, json_loads: Callable[[str | bytes], Any] = json.loads
) -> dict[str, Any]: ...
def compare_version(a: str, b: str, semver_precedence: bool = False) -> int: ...
def validate_rule_condition(condition: str) -> None: ...
def validate_sampling_condition(condition: str) -> None: ...
def validate_pii_selector(selector: str) -> None: ...
def validate_pii_config(config: str) -> None: ...
def convert_datascrubbing_config(
    config: Mapping[str, Any],
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
def pii_strip_event(
    config: Mapping[str, Any],
    event: Mapping[str, Any],
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
def pii_selector_suggestions_from_event(
    event: Mapping[str, Any],
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> list[Any]: ...
def normalize_project_config(
    config: Any,
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
def normalize_global_config(
    config: Any,
    json_dumps: Callable[[Any], Any] = json.dumps,
    json_loads: Callable[[str | bytes], Any] = json.loads,
) -> dict[str, Any]: ...
