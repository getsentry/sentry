from __future__ import annotations

from collections.abc import Generator, Iterator, Sequence
from typing import Any, Self

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


def _calculate_contributes[ValuesType](values: Sequence[ValuesType]) -> bool:
    for value in values or ():
        if not isinstance(value, BaseGroupingComponent) or value.contributes:
            return True
    return False


class BaseGroupingComponent[ValuesType: str | int | BaseGroupingComponent[Any]]:
    """A grouping component is a recursive structure that is flattened
    into components to make a hash for grouping purposes.
    """

    id: str = "default"
    hint: str | None = None
    contributes: bool = False
    values: Sequence[ValuesType]

    def __init__(
        self,
        id: str | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[ValuesType] | None = None,
        variant_provider: bool = False,
    ):
        self.id = id or self.id
        self.variant_provider = variant_provider

        self.update(
            hint=hint or DEFAULT_HINTS.get(self.id),
            contributes=contributes,
            values=values or [],
        )

    @property
    def name(self) -> str | None:
        return KNOWN_MAJOR_COMPONENT_NAMES.get(self.id)

    @property
    def description(self) -> str:
        """
        Build the component description by walking its component tree and collecting the names of
        contributing "major" components, to find the longest path of qualifying components from root
        to leaf. (See `KNOWN_MAJOR_COMPONENT_NAMES` above.)
        """

        # Keep track of the paths we walk so later we can pick the longest one
        paths = []

        def _walk_components(
            component: BaseGroupingComponent[Any], current_path: list[str | None]
        ) -> None:
            # Keep track of the names of the nodes from the root of the component tree to here
            current_path.append(component.name)

            # Walk the tree, looking for contributing components.
            for value in component.values:
                if isinstance(value, BaseGroupingComponent) and value.contributes:
                    _walk_components(value, current_path)

            # Filter out the `None`s (which come from components not in `KNOWN_MAJOR_COMPONENT_NAMES`)
            # before adding our current path to the list of possible longest paths
            paths.append([name for name in current_path if name])

            # We're about to finish processing this node, so pop it out of the path
            current_path.pop()

        # Find the longest path of contributing major components
        _walk_components(self, [])
        paths.sort(key=lambda x: (len(x), x))

        if paths and paths[-1]:
            return " ".join(paths[-1])

        return self.name or self.id

    def get_subcomponent(
        self, id: str, only_contributing: bool = False
    ) -> str | int | BaseGroupingComponent[Any] | None:
        """Looks up a subcomponent by the id and returns the first or `None`."""
        return next(self.iter_subcomponents(id=id, only_contributing=only_contributing), None)

    def iter_subcomponents(
        self, id: str, recursive: bool = False, only_contributing: bool = False
    ) -> Iterator[str | int | BaseGroupingComponent[Any] | None]:
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
        values: Sequence[ValuesType] | None = None,
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

    def shallow_copy(self) -> Self:
        """Creates a shallow copy."""
        rv = object.__new__(self.__class__)
        rv.__dict__.update(self.__dict__)
        rv.values = list(self.values)
        return rv

    def iter_values(self) -> Generator[str | int | BaseGroupingComponent[Any]]:
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


# NOTE: In all of the classes below, the type(s) passed to `BaseGroupingComponent` represent
# the type(s) which can appear in the `values` attribute


# Error-related inner components


class ContextLineGroupingComponent(BaseGroupingComponent[str]):
    id: str = "context-line"


class ErrorTypeGroupingComponent(BaseGroupingComponent[str]):
    id: str = "type"


class ErrorValueGroupingComponent(BaseGroupingComponent[str]):
    id: str = "value"


class FilenameGroupingComponent(BaseGroupingComponent[str]):
    id: str = "filename"


class FunctionGroupingComponent(BaseGroupingComponent[str]):
    id: str = "function"


class LineNumberGroupingComponent(BaseGroupingComponent[str]):
    id: str = "lineno"


class ModuleGroupingComponent(BaseGroupingComponent[str]):
    id: str = "module"


class NSErrorGroupingComponent(BaseGroupingComponent[str | int]):
    id: str = "ns-error"


class SymbolGroupingComponent(BaseGroupingComponent[str]):
    id: str = "symbol"


class FrameGroupingComponent(
    BaseGroupingComponent[
        ContextLineGroupingComponent
        | FilenameGroupingComponent
        | FunctionGroupingComponent
        | LineNumberGroupingComponent  # only in legacy config
        | ModuleGroupingComponent
        | SymbolGroupingComponent  # only in legacy config
    ]
):
    id: str = "frame"


# Security-related inner components


class HostnameGroupingComponent(BaseGroupingComponent[str]):
    id: str = "hostname"


class SaltGroupingComponent(BaseGroupingComponent[str]):
    id: str = "salt"
    hint: str = "a static salt"


class ViolationGroupingComponent(BaseGroupingComponent[str]):
    id: str = "violation"


class URIGroupingComponent(BaseGroupingComponent[str]):
    id: str = "uri"


# Top-level components


class MessageGroupingComponent(BaseGroupingComponent[str]):
    id: str = "message"


class StacktraceGroupingComponent(BaseGroupingComponent[FrameGroupingComponent]):
    id: str = "stacktrace"


class ExceptionGroupingComponent(
    BaseGroupingComponent[
        ErrorTypeGroupingComponent
        | ErrorValueGroupingComponent
        | NSErrorGroupingComponent
        | StacktraceGroupingComponent
    ]
):
    id: str = "exception"


class ChainedExceptionGroupingComponent(BaseGroupingComponent[ExceptionGroupingComponent]):
    id: str = "chained-exception"


class ThreadsGroupingComponent(BaseGroupingComponent[StacktraceGroupingComponent]):
    id: str = "threads"


class CSPGroupingComponent(
    BaseGroupingComponent[SaltGroupingComponent | ViolationGroupingComponent | URIGroupingComponent]
):
    id: str = "csp"


class ExpectCTGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "expect-ct"


class ExpectStapleGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "expect-staple"


class HPKPGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "hpkp"


class TemplateGroupingComponent(
    BaseGroupingComponent[ContextLineGroupingComponent | FilenameGroupingComponent]
):
    id: str = "template"
