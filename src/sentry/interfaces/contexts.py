import string

from django.utils.encoding import force_text

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path

__all__ = ("Contexts",)

context_types = {}


class _IndexFormatter(string.Formatter):
    def format_field(self, value, format_spec):
        if not format_spec and isinstance(value, bool):
            return value and "yes" or "no"
        return string.Formatter.format_field(self, value, format_spec)


def format_index_expr(format_string, data):
    return str(_IndexFormatter().vformat(str(format_string), (), data).strip())


def contexttype(cls):
    context_types[cls.type] = cls
    return cls


class ContextType:
    indexed_fields = None
    type = None

    def __init__(self, alias, data):
        self.alias = alias
        ctx_data = {}
        for key, value in data.items():
            # we use simple checks here, rather than ' in set()' to avoid
            # issues with maps/lists
            if value is not None and value != "":
                ctx_data[force_text(key)] = value
        self.data = ctx_data

    def to_json(self):
        rv = dict(self.data)
        rv["type"] = self.type
        return prune_empty_keys(rv)

    @classmethod
    def values_for_data(cls, data):
        rv = []
        for context in (data.get("contexts") or {}).values():
            if context and context.get("type") == cls.type:
                rv.append(context)
        return rv

    @classmethod
    def primary_value_for_data(cls, data):
        val = get_path(data, "contexts", cls.type)
        if val and val.get("type") == cls.type:
            return val

        rv = cls.values_for_data(data)
        if len(rv) == 1:
            return rv[0]

    def iter_tags(self):
        if self.indexed_fields:
            for field, f_string in self.indexed_fields.items():
                try:
                    value = format_index_expr(f_string, self.data)
                except KeyError:
                    continue
                if value:
                    if not field:
                        yield (self.alias, value)
                    else:
                        yield (f"{self.alias}.{field}", value)


# TODO(dcramer): contexts need to document/describe expected (optional) fields
@contexttype
class DefaultContextType(ContextType):
    type = "default"


@contexttype
class AppContextType(ContextType):
    type = "app"
    indexed_fields = {"device": "{device_app_hash}"}


@contexttype
class DeviceContextType(ContextType):
    type = "device"
    indexed_fields = {"": "{model}", "family": "{family}"}
    # model_id, arch


@contexttype
class RuntimeContextType(ContextType):
    type = "runtime"
    indexed_fields = {"": "{name} {version}", "name": "{name}"}


@contexttype
class BrowserContextType(ContextType):
    type = "browser"
    indexed_fields = {"": "{name} {version}", "name": "{name}"}
    # viewport


@contexttype
class OsContextType(ContextType):
    type = "os"
    indexed_fields = {"": "{name} {version}", "name": "{name}", "rooted": "{rooted}"}
    # build, rooted


@contexttype
class GpuContextType(ContextType):
    type = "gpu"
    indexed_fields = {"name": "{name}", "vendor": "{vendor_name}"}


@contexttype
class MonitorContextType(ContextType):
    type = "monitor"
    indexed_fields = {"id": "{id}"}


@contexttype
class TraceContextType(ContextType):
    type = "trace"
    indexed_fields = {}


class Contexts(Interface):
    """
    This interface stores context specific information.
    """

    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data):
        rv = {}
        for alias, value in data.items():
            # XXX(markus): The `None`-case should be handled in the UI and
            # other consumers of this interface
            if value is not None:
                rv[alias] = cls.normalize_context(alias, value)
        return cls(**rv)

    @classmethod
    def normalize_context(cls, alias, data):
        ctx_type = data.get("type", alias)
        ctx_cls = context_types.get(ctx_type, DefaultContextType)
        return ctx_cls(alias, data)

    def iter_contexts(self):
        return self._data.values()

    def to_json(self):
        rv = {}
        for alias, inst in self._data.items():
            rv[alias] = inst.to_json()
        return rv

    def iter_tags(self):
        for inst in self.iter_contexts():
            yield from inst.iter_tags()
