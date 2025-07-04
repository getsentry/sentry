from __future__ import annotations

import logging
from collections.abc import Mapping
from html import escape
from typing import Any, ClassVar, Self

from django.conf import settings
from django.utils.functional import classproperty
from django.utils.translation import gettext as _

from sentry.utils.imports import import_string
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.events")
interface_logger = logging.getLogger("sentry.interfaces")


def get_interface(name: str) -> type[Interface]:
    try:
        import_path = settings.SENTRY_INTERFACES[name]
    except KeyError:
        raise ValueError(f"Invalid interface name: {name}")

    try:
        interface = import_string(import_path)
    except Exception:
        raise ValueError(f"Unable to load interface: {name}")

    return interface


def get_interfaces(event: Mapping[str, Any]) -> dict[str, Interface]:
    result = []
    for key, data in event.items():
        # Skip invalid interfaces that were nulled out during normalization
        if data is None:
            continue

        try:
            cls = get_interface(key)
        except ValueError:
            continue

        value = safe_execute(cls.to_python, data)
        if not value:
            continue

        result.append((key, value))

    return {k: v for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True)}


class InterfaceValidationError(Exception):
    pass


class Interface:
    """
    An interface is a structured representation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    score = 0
    display_score: ClassVar[int | None] = None
    ephemeral = False
    grouping_variants = ["default"]

    def __init__(self, **data):
        self._data = data or {}

    @classproperty
    def path(cls):
        """The 'path' of the interface which is the root key in the data."""
        return cls.__name__.lower()

    @classproperty
    def external_type(cls):
        """The external name of the interface.  This is mostly the same as
        path with some small differences (message, debugmeta).
        Also used as the display name for grouping strategy hints.
        """
        return cls.path

    def __eq__(self, other):
        if not isinstance(self, type(other)):
            return False
        return self._data == other._data

    def __getstate__(self):
        return {"_data": self._data}

    def __setstate__(self, state):
        self.__dict__.update(state)
        if not hasattr(self, "_data"):
            self._data = {}

    def __getattr__(self, name):
        return self._data[name]

    def __setattr__(self, name, value):
        if name == "_data":
            self.__dict__["_data"] = value
        else:
            self._data[name] = value

    @classmethod
    def to_python(cls, data) -> Self | None:
        """Creates a python interface object from the given raw data.

        This function can assume fully normalized and valid data. It can create
        defaults where data is missing but does not need to handle interface
        validation.
        """
        if data is None:
            return None

        return cls(**data)

    def get_raw_data(self):
        """Returns the underlying raw data."""
        return self._data

    def get_api_context(self, is_public=False, platform=None):
        return self.to_json()

    def get_api_meta(self, meta, is_public=False, platform=None):
        return meta

    def to_json(self):
        return prune_empty_keys(self._data)

    def get_title(self):
        return _(type(self).__name__)

    def get_display_score(self) -> int:
        return self.display_score or self.score

    def get_score(self) -> int:
        return self.score

    def iter_tags(self):
        return iter(())

    def to_string(self, event) -> str:
        return ""

    def to_email_html(self, event, **kwargs):
        body = self.to_string(event)
        if not body:
            return ""
        return f"<pre>{escape(body)}</pre>"
