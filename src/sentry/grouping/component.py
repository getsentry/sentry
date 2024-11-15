from __future__ import annotations

from collections.abc import Generator, Iterator, Sequence
from typing import Any

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


def _calculate_contributes(values: Sequence[str | int | GroupingComponent]) -> bool:
    for value in values or ():
        if not isinstance(value, GroupingComponent) or value.contributes:
            return True
    return False


class GroupingComponent:
    """A grouping component is a recursive structure that is flattened
    into components to make a hash for grouping purposes.
    """

    id: str = "default"
    hint: str | None = None
    contributes: bool = False
    values: Sequence[str | int | GroupingComponent]

    def __init__(
        self,
        id: str,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[str | int | GroupingComponent] | None = None,
        variant_provider: bool = False,
    ):
        self.id = id
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

        def _walk_components(component: GroupingComponent, current_path: list[str | None]) -> None:
            # Keep track of the names of the nodes from the root of the component tree to here
            current_path.append(component.name)

            # Walk the tree, looking for contributing components.
            for value in component.values:
                if isinstance(value, GroupingComponent) and value.contributes:
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
    ) -> str | int | GroupingComponent | None:
        """Looks up a subcomponent by the id and returns the first or `None`."""
        return next(self.iter_subcomponents(id=id, only_contributing=only_contributing), None)

    def iter_subcomponents(
        self, id: str, recursive: bool = False, only_contributing: bool = False
    ) -> Iterator[str | int | GroupingComponent | None]:
        """Finds all subcomponents matching an id, optionally recursively."""
        for value in self.values:
            if isinstance(value, GroupingComponent):
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
        values: Sequence[str | int | GroupingComponent] | None = None,
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

    def shallow_copy(self) -> GroupingComponent:
        """Creates a shallow copy."""
        rv = object.__new__(self.__class__)
        rv.__dict__.update(self.__dict__)
        rv.values = list(self.values)
        return rv

    def iter_values(self) -> Generator[str | int | GroupingComponent]:
        """Recursively walks the component and flattens it into a list of
        values.
        """
        if self.contributes:
            for value in self.values:
                if isinstance(value, GroupingComponent):
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
            if isinstance(value, GroupingComponent):
                rv["values"].append(value.as_dict())
            else:
                # This basically assumes that a value is only a primitive
                # and never an object or list. This should be okay
                # because we verify this.
                rv["values"].append(value)
        return rv

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.id!r}, hint={self.hint!r}, contributes={self.contributes!r}, values={self.values!r})"
