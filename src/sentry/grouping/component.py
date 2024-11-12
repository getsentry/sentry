from __future__ import annotations

from collections.abc import Generator, Iterator, Sequence
from typing import Any, Generic, TypeVar

from sentry.grouping.utils import hash_from_values

DEFAULT_HINTS = {"salt": "a static salt"}

# When a component ID appears here it has a human readable name which also
# makes it a major component.  A major component is described as such for
# the UI.
KNOWN_MAJOR_COMPONENT_NAMES = {
    "app": "in-app",
    "exception": "exception",
    "stacktrace": "stack-trace",
    "threads": "thread",
    "hostname": "hostname",
    "violation": "violation",
    "uri": "URL",
    "message": "message",
    "template": "template",
}


def _calculate_contributes(values: Sequence[str | int | BaseGroupingComponent]) -> bool:
    for value in values or ():
        if not isinstance(value, BaseGroupingComponent) or value.contributes:
            return True
    return False


class BaseGroupingComponent:
    """A grouping component is a recursive structure that is flattened
    into components to make a hash for grouping purposes.
    """

    id: str = "default"
    hint: str | None
    contributes: bool | None
    values: Sequence[str | int | BaseGroupingComponent]

    def __init__(
        self,
        id: str | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[str | int | BaseGroupingComponent] | None = None,
        variant_provider: bool = False,
    ):
        self.id = id or self.id

        # Default values
        self.hint = DEFAULT_HINTS.get(self.id)
        self.contributes = contributes
        self.variant_provider = variant_provider
        self.values: Sequence[str | int | BaseGroupingComponent] = []

        self.update(
            hint=hint,
            contributes=contributes,
            values=values,
        )

    @property
    def name(self) -> str | None:
        return KNOWN_MAJOR_COMPONENT_NAMES.get(self.id)

    @property
    def description(self) -> str:
        items = []

        def _walk_components(c: BaseGroupingComponent, stack: list[str | None]) -> None:
            stack.append(c.name)
            for value in c.values:
                if isinstance(value, BaseGroupingComponent) and value.contributes:
                    _walk_components(value, stack)
            parts = [_f for _f in stack if _f]
            items.append(parts)
            stack.pop()

        _walk_components(self, [])
        items.sort(key=lambda x: (len(x), x))

        if items and items[-1]:
            return " ".join(items[-1])

        return self.name or self.id

    def get_subcomponent(
        self, id: str, only_contributing: bool = False
    ) -> str | int | BaseGroupingComponent | None:
        """Looks up a subcomponent by the id and returns the first or `None`."""
        return next(self.iter_subcomponents(id=id, only_contributing=only_contributing), None)

    def iter_subcomponents(
        self, id: str, recursive: bool = False, only_contributing: bool = False
    ) -> Iterator[str | int | BaseGroupingComponent | None]:
        """Finds all subcomponents matching an id, optionally recursively."""
        for value in self.values:
            if isinstance(value, BaseGroupingComponent):
                if only_contributing and not value.contributes:
                    continue
                if value.id == id:
                    yield value
                if recursive:
                    yield from value.iter_subcomponents(
                        id, recursive=True, only_contributing=only_contributing
                    )
        yield from ()  # yield an empty generator

    def update(
        self,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[str | int | BaseGroupingComponent] | None = None,
    ) -> None:
        """Updates an already existing component with new values."""
        if hint is not None:
            self.hint = hint
        if values is not None:
            if contributes is None:
                contributes = _calculate_contributes(values)
            self.values = values
        if contributes is not None:
            self.contributes = contributes

    def shallow_copy(self) -> BaseGroupingComponent:
        """Creates a shallow copy."""
        rv = object.__new__(self.__class__)
        rv.__dict__.update(self.__dict__)
        rv.values = list(self.values)
        return rv

    def iter_values(self) -> Generator[str | int | BaseGroupingComponent]:
        """Recursively walks the component and flattens it into a list of
        values.
        """
        if self.contributes:
            for value in self.values:
                if isinstance(value, BaseGroupingComponent):
                    yield from value.iter_values()
                else:
                    yield value
        yield from ()  # yield an empty generator

    def get_hash(self) -> str | None:
        """Returns the hash of the values if it contributes."""
        if self.contributes:
            return hash_from_values(self.iter_values())
        return None

    def as_dict(self) -> dict[str, Any]:
        """Converts the component tree into a dictionary."""
        rv: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "contributes": self.contributes,
            "hint": self.hint,
            "values": [],
        }
        for value in self.values:
            if isinstance(value, BaseGroupingComponent):
                rv["values"].append(value.as_dict())
            else:
                # This basically assumes that a value is only a primitive
                # and never an object or list. This should be okay
                # because we verify this.
                rv["values"].append(value)
        return rv

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.id!r}, hint={self.hint!r}, contributes={self.contributes!r}, values={self.values!r})"


GroupingComponent = TypeVar("GroupingComponent", bound=BaseGroupingComponent)
ValueType = TypeVar("ValueType", bound=(str | int))


class ValueGroupingComponent(BaseGroupingComponent, Generic[ValueType]):
    """
    A component whose `values` is a list of a single actual value rather than a lit of other
    grouping components.
    """

    values: list[ValueType]


# Top-level components


class MessageGroupingComponent(ValueGroupingComponent[str]):
    id: str = "message"


class ExceptionGroupingComponent(BaseGroupingComponent):
    id: str = "exception"
    values: list[
        ErrorTypeGroupingComponent
        | ErrorValueGroupingComponent
        | NSErrorGroupingComponent
        | StacktraceGroupingComponent
    ]


class ChainedExceptionGroupingComponent(BaseGroupingComponent):
    id: str = "chained-exception"
    values: list[ExceptionGroupingComponent]


class StacktraceGroupingComponent(BaseGroupingComponent):
    id: str = "stacktrace"
    values: list[FrameGroupingComponent]


class ThreadsGroupingComponent(BaseGroupingComponent):
    id: str = "threads"
    values: list[StacktraceGroupingComponent]


class CSPGroupingComponent(BaseGroupingComponent):
    id: str = "csp"
    values: list[SaltGroupingComponent | ViolationGroupingComponent | URIGroupingComponent]


class ExpectCTGroupingComponent(BaseGroupingComponent):
    id: str = "expect-ct"
    values: list[HostnameGroupingComponent | SaltGroupingComponent]


class ExpectStapleGroupingComponent(BaseGroupingComponent):
    id: str = "expect-staple"
    values: list[HostnameGroupingComponent | SaltGroupingComponent]


class HPKPGroupingComponent(BaseGroupingComponent):
    id: str = "hpkp"
    values: list[HostnameGroupingComponent | SaltGroupingComponent]


class TemplateGroupingComponent(BaseGroupingComponent):
    id: str = "template"
    values: list[ContextLineGroupingComponent | FilenameGroupingComponent]


# Error-related inner components


class FrameGroupingComponent(BaseGroupingComponent):
    id: str = "frame"
    values: list[
        ContextLineGroupingComponent
        | FilenameGroupingComponent
        | FunctionGroupingComponent
        | LineNumberGroupingComponent  # only in legacy config
        | ModuleGroupingComponent
        | SymbolGroupingComponent  # only in legacy config
    ]


class ContextLineGroupingComponent(ValueGroupingComponent[str]):
    id: str = "context-line"


class ErrorTypeGroupingComponent(ValueGroupingComponent[str]):
    id: str = "type"


class ErrorValueGroupingComponent(ValueGroupingComponent[str]):
    id: str = "value"


class FilenameGroupingComponent(ValueGroupingComponent[str]):
    id: str = "filename"


class FunctionGroupingComponent(ValueGroupingComponent[str]):
    id: str = "function"


class LineNumberGroupingComponent(ValueGroupingComponent[str]):
    id: str = "lineno"


class ModuleGroupingComponent(ValueGroupingComponent[str]):
    id: str = "module"


class NSErrorGroupingComponent(ValueGroupingComponent[str | int]):
    id: str = "ns-error"


class SymbolGroupingComponent(ValueGroupingComponent[str]):
    id: str = "symbol"


# Security-related inner components


class HostnameGroupingComponent(ValueGroupingComponent[str]):
    id: str = "hostname"


class SaltGroupingComponent(ValueGroupingComponent[str]):
    id: str = "salt"
    hint: str = "a static salt"


class ViolationGroupingComponent(ValueGroupingComponent[str]):
    id: str = "violation"


class URIGroupingComponent(ValueGroupingComponent[str]):
    id: str = "uri"
