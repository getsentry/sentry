"""
Resolves which team owns each API endpoint, including owners inherited from base classes
"""

import inspect
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from django.urls import URLPattern, URLResolver, get_resolver

from sentry.api.base import Endpoint

_REPO_ROOT = Path(__file__).resolve().parents[3]


def get_endpoint_classes_from_url_patterns(
    url_patterns: Sequence[URLPattern | URLResolver],
) -> list[type[Endpoint]]:
    """
    Return a list of all Endpoint classes from the given url patterns or resolvers
    """

    classes: list[type[Endpoint]] = []

    for item in url_patterns:
        if isinstance(item, URLResolver):
            inner_classes = get_endpoint_classes_from_url_patterns(item.url_patterns)
            for cls in inner_classes:
                if cls not in classes:
                    classes.append(cls)
        else:
            callback = item.callback
            if not hasattr(callback, "view_class"):
                continue
            view_class = callback.view_class
            if not issubclass(view_class, Endpoint):
                continue
            if view_class not in classes:
                classes.append(view_class)

    return classes


@dataclass(frozen=True, order=True)
class EndpointOwner:
    """
    One row of the owner map: the file an endpoint class is defined in, its name, and
    the team that owns it. Rows sort by path, then class_name, so the map always comes
    out in the same order
    """

    path: str
    class_name: str
    owner: str


def build_owner_map(
    url_patterns: Sequence[URLPattern | URLResolver] | None = None,
) -> list[EndpointOwner]:
    """
    Returns a list of EndpointOwner objects for the given url patterns, or all of Django's
    urls by default. Python's attribute lookup resolves each owner: the nearest class that
    sets owner, or Endpoint's default of ApiOwner.UNOWNED
    """
    if url_patterns is None:
        url_patterns = get_resolver().url_patterns
    classes = get_endpoint_classes_from_url_patterns(url_patterns)

    endpoint_owners: list[EndpointOwner] = []
    for cls in classes:
        source_file = inspect.getsourcefile(cls)

        if source_file is None:
            raise ValueError(f"Could not find the source file for {cls.__name__}")

        rel_path = Path(source_file).relative_to(_REPO_ROOT).as_posix()

        endpoint_owners.append(
            EndpointOwner(
                path=rel_path,
                class_name=cls.__name__,
                owner=cls.owner.value,
            )
        )

    endpoint_owners.sort()
    return endpoint_owners
