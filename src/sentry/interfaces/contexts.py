from __future__ import annotations
import string
from typing import ClassVar, TypeVar

from django.utils.encoding import force_str

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path

__all__ = ("Contexts",)

ContextTypeT = TypeVar("ContextTypeT", bound="ContextType")

context_types: dict[str, type[ContextType]] = {}


class _IndexFormatter(string.Formatter):
    def format_field(self, value, format_spec):
        if not format_spec and isinstance(value, bool):
            return "yes" if value else "no"
        return super().format_field(value, format_spec)

def format_index_expr(format_string, data):
    return str(_IndexFormatter().vformat(str(format_string), (), data).strip())

def contexttype(cls: type[ContextTypeT]) -> type[ContextTypeT]:
    context_types[cls.type] = cls
    return cls

# NOTE: Are you adding a new context? Make sure to also update the
# documentation in the sentry develop docs [0]!
#
# [0]: https://develop.sentry.dev/sdk/event-payloads/contexts
class ContextType:
    context_to_tag_mapping: ClassVar[dict[str, str]] = {}

    type: str

    def __init__(self, alias, data):
        self.alias = alias
        ctx_data = {}
        for key, value in data.items():
            if value is not None:
                ctx_data[force_str(key)] = value
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

    def iter_tags(self):
        if self.context_to_tag_mapping:
            for field, f_string in self.context_to_tag_mapping.items():
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
    context_to_tag_mapping = {"device": "{device_app_hash}"}

@contexttype
class DeviceContextType(ContextType):
    type = "device"
    context_to_tag_mapping = {"": "{model}", "family": "{family}"}

@contexttype
class RuntimeContextType(ContextType):
    type = "runtime"
    context_to_tag_mapping = {"": "{name} {version}", "name": "{name}"}

@contexttype
class BrowserContextType(ContextType):
    type = "browser"
    context_to_tag_mapping = {"": "{name} {version}", "name": "{name}"}

@contexttype
class OsContextType(ContextType):
    type = "os"
    context_to_tag_mapping = {"": "{name} {version}", "name": "{name}", "rooted": "{rooted}"}

@contexttype
class GpuContextType(ContextType):
    type = "gpu"
    context_to_tag_mapping = {"name": "{name}", "vendor": "{vendor_name}"}

@contexttype
class MonitorContextType(ContextType):
    type = "monitor"
    context_to_tag_mapping = {"id": "{id}", "slug": "{slug}"}

@contexttype
class TraceContextType(ContextType):
    type = "trace"
    context_to_tag_mapping = {}

@contexttype
class OtelContextType(ContextType):
    type = "otel"
    context_to_tag_mapping = {}

class Contexts(Interface):
    """
    This interface stores context specific information.
    """

    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data, **kwargs):
        rv = {}
        for alias, value in data.items():
            if value is not None:
                rv[alias] = cls.normalize_context(alias, value)
        return super().to_python(rv, **kwargs)

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
