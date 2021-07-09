__all__ = ("Exception", "Mechanism", "upgrade_legacy_mechanism")

import re

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace
from sentry.utils.json import prune_empty_keys
from sentry.utils.safe import get_path

_type_value_re = re.compile(r"^(\w+):(.*)$")


def upgrade_legacy_mechanism(data):
    """
    Conversion from mechanism objects sent by old sentry-cocoa SDKs. It assumes
    "type": "generic" and moves "posix_signal", "mach_exception" into "meta".
    All other keys are moved into "data".

    Example old payload:
    >>> {
    >>>     "posix_signal": {
    >>>         "name": "SIGSEGV",
    >>>         "code_name": "SEGV_NOOP",
    >>>         "signal": 11,
    >>>         "code": 0
    >>>     },
    >>>     "relevant_address": "0x1",
    >>>     "mach_exception": {
    >>>         "exception": 1,
    >>>         "exception_name": "EXC_BAD_ACCESS",
    >>>         "subcode": 8,
    >>>         "code": 1
    >>>     }
    >>> }

    Example normalization:
    >>> {
    >>>     "type": "generic",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>             "exception": 1,
    >>>             "subcode": 8,
    >>>             "code": 1,
    >>>             "name": "EXC_BAD_ACCESS"
    >>>         },
    >>>         "signal": {
    >>>             "number": 11,
    >>>             "code": 0,
    >>>             "name": "SIGSEGV",
    >>>             "code_name": "SEGV_NOOP"
    >>>         }
    >>>     }
    >>> }
    """

    # Early exit for current protocol. We assume that when someone sends a
    # "type", we do not need to preprocess and can immediately validate
    if data is None or data.get("type") is not None:
        return data

    result = {"type": "generic"}

    # "posix_signal" and "mach_exception" were optional root-level objects,
    # which have now moved to special keys inside "meta". We only create "meta"
    # if there is actual data to add.

    posix_signal = data.pop("posix_signal", None)
    if posix_signal and posix_signal.get("signal"):
        result.setdefault("meta", {})["signal"] = prune_empty_keys(
            {
                "number": posix_signal.get("signal"),
                "code": posix_signal.get("code"),
                "name": posix_signal.get("name"),
                "code_name": posix_signal.get("code_name"),
            }
        )

    mach_exception = data.pop("mach_exception", None)
    if mach_exception:
        result.setdefault("meta", {})["mach_exception"] = prune_empty_keys(
            {
                "exception": mach_exception.get("exception"),
                "code": mach_exception.get("code"),
                "subcode": mach_exception.get("subcode"),
                "name": mach_exception.get("exception_name"),
            }
        )

    # All remaining data has to be moved to the "data" key. We assume that even
    # if someone accidentally sent a corret top-level key (such as "handled"),
    # it will not pass our interface validation and should be moved to "data"
    # instead.
    result.setdefault("data", {}).update(data)
    return result


class Mechanism(Interface):
    """
    an optional field residing in the exception interface. It carries additional
    information about the way the exception was created on the target system.
    This includes general exception values obtained from operating system or
    runtime APIs, as well as mechanism-specific values.

    >>> {
    >>>     "type": "mach",
    >>>     "description": "EXC_BAD_ACCESS",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "handled": false,
    >>>     "synthetic": false,
    >>>     "help_link": "https://developer.apple.com/library/content/qa/qa1367/_index.html",
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>              "exception": 1,
    >>>              "subcode": 8,
    >>>              "code": 1
    >>>         },
    >>>         "signal": {
    >>>             "number": 11
    >>>         }
    >>>     }
    >>> }
    """

    @classmethod
    def to_python(cls, data, **kwargs):
        for key in ("type", "synthetic", "description", "help_link", "handled", "data", "meta"):
            data.setdefault(key, None)

        return super().to_python(data, **kwargs)

    def to_json(self):
        return prune_empty_keys(
            {
                "type": self.type,
                "synthetic": self.synthetic,
                "description": self.description,
                "help_link": self.help_link,
                "handled": self.handled,
                "data": self.data or None,
                "meta": prune_empty_keys(self.meta) or None,
            }
        )

    def iter_tags(self):
        yield (self.path, self.type)

        if self.handled is not None:
            yield ("handled", self.handled and "yes" or "no")


def uncontribute_non_stacktrace_variants(variants):
    """If we have multiple variants and at least one has a stacktrace, we
    want to mark all non stacktrace variants non contributing.  The reason
    for this is that otherwise we end up in very generic grouping which has
    some negative consequences for the quality of the groups.
    """
    if len(variants) <= 1:
        return variants
    any_stacktrace_contributes = False
    non_contributing_components = []
    stacktrace_variants = set()

    # In case any of the variants has a contributing stacktrace, we want
    # to make all other variants non contributing.  Thr e
    for (key, component) in variants.items():
        if any(
            s.contributes for s in component.iter_subcomponents(id="stacktrace", recursive=True)
        ):
            any_stacktrace_contributes = True
            stacktrace_variants.add(key)
        else:
            non_contributing_components.append(component)

    if any_stacktrace_contributes:
        if len(stacktrace_variants) == 1:
            hint_suffix = "but the %s variant does" % next(iter(stacktrace_variants))
        else:
            # this branch is basically dead because we only have two
            # variants right now, but this is so this does not break in
            # the future.
            hint_suffix = "others do"
        for component in non_contributing_components:
            component.update(
                contributes=False,
                hint="ignored because this variant does not contain a "
                "stacktrace, but %s" % hint_suffix,
            )

    return variants


class SingleException(Interface):
    """
    A standard exception with a ``type`` and value argument, and an optional
    ``module`` argument describing the exception class type and
    module namespace. Either ``type`` or ``value`` must be present.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``stacktrace``.

    >>> {
    >>>     "type": "ValueError",
    >>>     "value": "My exception value",
    >>>     "module": "__builtins__",
    >>>     "mechanism": {},
    >>>     "stacktrace": {
    >>>         # see stacktrace
    >>>     }
    >>> }
    """

    grouping_variants = ["system", "app"]

    @classmethod
    def to_python(cls, data, **kwargs):
        if get_path(data, "stacktrace", "frames", filter=True):
            stacktrace = Stacktrace.to_python_subpath(data, ["stacktrace"], **kwargs)
        else:
            stacktrace = None

        if get_path(data, "raw_stacktrace", "frames", filter=True):
            raw_stacktrace = Stacktrace.to_python_subpath(data, ["raw_stacktrace"], **kwargs)
        else:
            raw_stacktrace = None

        type = data.get("type")
        value = data.get("value")

        if data.get("mechanism"):
            mechanism = Mechanism.to_python_subpath(data, ["mechanism"], **kwargs)
        else:
            mechanism = None

        new_data = {
            "type": type,
            "value": value,
            "module": data.get("module"),
            "mechanism": mechanism,
            "stacktrace": stacktrace,
            "thread_id": data.get("thread_id"),
            "raw_stacktrace": raw_stacktrace,
        }

        return super().to_python(new_data, **kwargs)

    def to_json(self):
        mechanism = (
            isinstance(self.mechanism, Mechanism)
            and self.mechanism.to_json()
            or self.mechanism
            or None
        )

        if self.stacktrace:
            stacktrace = self.stacktrace.to_json()
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.to_json()
        else:
            raw_stacktrace = None

        return prune_empty_keys(
            {
                "type": self.type,
                "value": self.value,
                "mechanism": mechanism,
                "module": self.module,
                "stacktrace": stacktrace,
                "thread_id": self.thread_id,
                "raw_stacktrace": raw_stacktrace,
            }
        )

    def get_api_context(self, is_public=False, platform=None):
        mechanism = (
            isinstance(self.mechanism, Mechanism)
            and self.mechanism.get_api_context(is_public=is_public, platform=platform)
            or self.mechanism
            or None
        )

        if self.stacktrace:
            stacktrace = self.stacktrace.get_api_context(is_public=is_public, platform=platform)
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.get_api_context(
                is_public=is_public, platform=platform
            )
        else:
            raw_stacktrace = None

        return {
            "type": self.type,
            "value": str(self.value) if self.value else None,
            "mechanism": mechanism,
            "threadId": self.thread_id,
            "module": self.module,
            "stacktrace": stacktrace,
            "rawStacktrace": raw_stacktrace,
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        mechanism_meta = (
            self.mechanism.get_api_meta(meta["mechanism"], is_public=is_public, platform=platform)
            if isinstance(self.mechanism, Mechanism) and meta.get("mechanism")
            else None
        )

        stacktrace_meta = (
            self.stacktrace.get_api_meta(meta, is_public=is_public, platform=platform)
            if self.stacktrace and meta.get("stacktrace")
            else None
        )

        return {
            "": meta.get(""),
            "type": meta.get("type"),
            "value": meta.get("value"),
            "mechanism": mechanism_meta,
            "threadId": meta.get("thread_id"),
            "module": meta.get("module"),
            "stacktrace": stacktrace_meta,
        }


class Exception(Interface):
    """
    An exception consists of a list of values. In most cases, this list
    contains a single exception, with an optional stacktrace interface.

    Each exception has a mandatory ``value`` argument and optional ``type`` and
    ``module`` arguments describing the exception class type and module
    namespace.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``stacktrace``.

    >>> {
    >>>     "values": [{
    >>>         "type": "ValueError",
    >>>         "value": "My exception value",
    >>>         "module": "__builtins__",
    >>>         "mechanism": {
    >>>             # see sentry.interfaces.Mechanism
    >>>         },
    >>>         "stacktrace": {
    >>>             # see stacktrace
    >>>         }
    >>>     }]
    >>> }

    Values should be sent oldest to newest, this includes both the stacktrace
    and the exception itself.

    .. note:: This interface can be passed as the 'exception' key in addition
              to the full interface path.
    """

    score = 2000
    grouping_variants = ["system", "app"]

    def exceptions(self):
        return get_path(self.values, filter=True)

    def __getitem__(self, key):
        return self.exceptions()[key]

    def __iter__(self):
        return iter(self.exceptions())

    def __len__(self):
        return len(self.exceptions())

    @classmethod
    def to_python(cls, data, **kwargs):
        values = []
        for i, v in enumerate(get_path(data, "values", default=[])):
            if not v:
                # Cannot skip over None-values, need to preserve offsets
                values.append(v)
            else:
                values.append(SingleException.to_python_subpath(data, ["values", i], **kwargs))

        return super().to_python(
            {"values": values, "exc_omitted": data.get("exc_omitted")}, **kwargs
        )

    # TODO(ja): Fix all following methods when to_python is refactored. All
    # methods below might throw if None exceptions are in ``values``.

    def to_json(self):
        return prune_empty_keys(
            {
                "values": [v and v.to_json() for v in self.values] or None,
                "exc_omitted": self.exc_omitted,
            }
        )

    def get_api_context(self, is_public=False, platform=None):
        return {
            "values": [
                v.get_api_context(is_public=is_public, platform=platform) for v in self.values if v
            ],
            "hasSystemFrames": any(
                v.stacktrace.get_has_system_frames() for v in self.values if v and v.stacktrace
            ),
            "excOmitted": self.exc_omitted,
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        if not meta:
            return meta

        result = {}
        values = meta.get("values", meta)
        for index, value in values.items():
            exc = self.values[int(index)]
            if exc is not None:
                result[index] = exc.get_api_meta(value, is_public=is_public, platform=platform)

        return {"values": result}

    def to_string(self, event, is_public=False, **kwargs):
        if not self.values:
            return ""

        output = []
        for exc in self.values:
            if not exc:
                continue

            output.append(f"{exc.type}: {exc.value}\n")
            if exc.stacktrace:
                output.append(
                    exc.stacktrace.get_stacktrace(
                        event, system_frames=False, max_frames=5, header=False
                    )
                    + "\n\n"
                )
        return ("".join(output)).strip()

    def get_stacktrace(self, *args, **kwargs):
        exc = self.values[0]
        if exc.stacktrace:
            return exc.stacktrace.get_stacktrace(*args, **kwargs)
        return ""

    def iter_tags(self):
        if not self.values or not self.values[0]:
            return

        mechanism = self.values[0].mechanism
        if mechanism:
            yield from mechanism.iter_tags()
