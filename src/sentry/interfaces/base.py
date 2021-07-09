import logging
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Union

from django.conf import settings
from django.utils.translation import ugettext as _

from sentry.utils.canonical import get_canonical_name
from sentry.utils.decorators import classproperty
from sentry.utils.html import escape
from sentry.utils.imports import import_string
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path, safe_execute

logger = logging.getLogger("sentry.events")
interface_logger = logging.getLogger("sentry.interfaces")

DataPath = List[Union[str, int]]


def get_interface(name):
    try:
        name = get_canonical_name(name)
        import_path = settings.SENTRY_INTERFACES[name]
    except KeyError:
        raise ValueError(f"Invalid interface name: {name}")

    try:
        interface = import_string(import_path)
    except Exception:
        raise ValueError(f"Unable to load interface: {name}")

    return interface


def get_interfaces(data):
    result = []
    for key, data in data.items():
        # Skip invalid interfaces that were nulled out during normalization
        if data is None:
            continue

        try:
            cls = get_interface(key)
        except ValueError:
            continue

        value = safe_execute(cls.to_python, data, datapath=[key], _with_transaction=False)
        if not value:
            continue

        result.append((key, value))

    return OrderedDict(
        (k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True)
    )


class InterfaceValidationError(Exception):
    pass


class Interface:
    """
    An interface is a structured representation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    _data: Dict[str, Any]
    score = 0
    display_score = None
    ephemeral = False
    grouping_variants = ["default"]
    datapath = None

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
    def to_python(cls, data, datapath: Optional[DataPath] = None):
        """Creates a python interface object from the given raw data.

        This function can assume fully normalized and valid data. It can create
        defaults where data is missing but does not need to handle interface
        validation.
        """
        if data is None:
            return None

        rv = cls(**data)
        object.__setattr__(rv, "datapath", datapath)
        return rv

    @classmethod
    def to_python_subpath(cls, data, path: DataPath, datapath: Optional[DataPath] = None):
        if data is None:
            return None

        subdata = get_path(data, *path)
        return cls.to_python(subdata, datapath=datapath + path if datapath else None)

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

    def get_display_score(self):
        return self.display_score or self.score

    def get_score(self):
        return self.score

    def iter_tags(self):
        return iter(())

    def to_string(self, event, is_public=False, **kwargs):
        return ""

    def to_email_html(self, event, **kwargs):
        body = self.to_string(event)
        if not body:
            return ""
        return f"<pre>{escape(body)}</pre>"

    # deprecated stuff.  These were deprecated in late 2018, once
    # determined they are unused we can kill them.

    def get_path(self):
        from warnings import warn

        warn(DeprecationWarning("Replaced with .path"))
        return self.path

    def get_alias(self):
        from warnings import warn

        warn(DeprecationWarning("Replaced with .path"))
        return self.path

    def get_slug(self):
        from warnings import warn

        warn(DeprecationWarning("Replaced with .path"))
        return self.path
