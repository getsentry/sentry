import re
import sys
from collections.abc import Generator, Iterable
from dataclasses import dataclass
from typing import TextIO

import yaml
from django.urls import ResolverMatch, get_resolver, resolve
from drf_spectacular.generators import EndpointEnumerator

from sentry.api.api_owners import ApiOwner


@dataclass
class Endpoint:
    path: str
    cls: type
    owner: ApiOwner
    name: str

    def to_dict_item(self) -> tuple[str, dict[str, str]]:
        return (
            self.path,
            {
                "class": f"{self.cls.__module__}.{self.cls.__qualname__}",
                "owner": self.owner.value,
                "name": self.name,
            },
        )


def resolve_api_endpoint(path: str) -> ResolverMatch:
    """Resolve the class of an endpoint from a path."""
    path = path.lstrip("/")
    return resolve(f"/api/0/{path}")


def process_endpoint(endpoint: str) -> Endpoint:
    """Process an endpoint string into an Endpoint object."""
    resolved = resolve_api_endpoint(endpoint)
    cls = resolved.func.cls
    owner = cls.owner
    name = resolved.url_name
    return Endpoint(endpoint, cls, owner, name)


def process_endpoints(endpoints: Iterable[str]) -> dict[str, dict[str, str]]:
    """Process an iterable of endpoint strings into a dictionary of Endpoint objects."""
    return dict(process_endpoint(endpoint).to_dict_item() for endpoint in endpoints)


def read_endpoints_from_yaml(file_obj: TextIO) -> list[str]:
    """Read a list of endpoints from a YAML file from a file object."""
    return yaml.safe_load(file_obj)


def process_yaml(input_path: str, output_path: str):
    """Process a YAML file into a dictionary of endpoints."""
    with open(input_path) as f:
        endpoints_str = read_endpoints_from_yaml(f)
    endpoints = process_endpoints(endpoints_str)
    with open(output_path, "w") as f:
        yaml.dump(endpoints, f)


def all_api_endpoints() -> Generator[str]:
    """Generate all API endpoints.

    Get all API endpoints (that is, all endpoints that start with /api/0/).
    Return the path without the /api/0 prefix.
    """
    enumerator = EndpointEnumerator(get_resolver().url_patterns)
    api_0_prefix = re.compile(r"^/api/0(/.*)$")

    for path, *_ in enumerator.get_api_endpoints():
        match = api_0_prefix.match(path)
        if match:
            yield match.group(1)


def main():
    endpoints = process_endpoints(all_api_endpoints())
    yaml.dump(endpoints, sys.stdout)


if __name__ == "__main__":
    main()
