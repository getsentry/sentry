from dataclasses import dataclass
from typing import TextIO

import yaml
from django.urls import ResolverMatch, resolve

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


def process_endpoints(endpoints: list[str]) -> dict[str, dict[str, str]]:
    """Process a list of endpoint strings into a list of Endpoint objects."""
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


if __name__ == "__main__":
    process_yaml("api_endpoints_absolute_false_list.yaml", "output.yaml")
