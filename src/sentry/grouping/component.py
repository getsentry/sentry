from __future__ import annotations

from abc import ABC, abstractmethod
from collections import Counter
from collections.abc import Generator, Iterator, Sequence
from functools import cached_property
from typing import int, Any

import sentry_sdk

from sentry.grouping.utils import hash_from_values
from sentry.utils.env import in_test_environment

# When a component ID appears here it has a human readable name which also
# makes it a major component.  A major component is described as such for
# the UI.
KNOWN_MAJOR_COMPONENT_NAMES = {
    "app": "in-app",
    "exception": "exception",
    "stacktrace": "stacktrace",
    "threads": "thread",
    "hostname": "hostname",
    "violation": "violation",
    "uri": "URL",
    "message": "message",
    "template": "template",
}


def _calculate_contributes[ValuesType](values: Sequence[ValuesType]) -> bool:
    """
    Determine the `contributes` value based on the given `values` list.

    Returns True if the values are constants or if at least one grouping component in the list
    contributes.
    """
    for value in values or ():
        if not isinstance(value, BaseGroupingComponent) or value.contributes:
            return True
    return False


class BaseGroupingComponent[ValuesType: str | int | BaseGroupingComponent[Any]](ABC):
    """
    A grouping component is a node in a tree describing the event data (exceptions, stacktraces,
    messages, etc.) which can contribute to grouping. Each node's children, stored in the `values`
    attribute, are either other grouping components or primitives representing the actual data.

    For example, an exception component might have type, value, and stacktrace components as
    children, and the type component might have the string "KeyError" as its child.
    """

    hint: str | None = None
    contributes: bool = False
    values: Sequence[ValuesType]

    def __init__(
        self,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[ValuesType] | None = None,
    ):
        # Use `upate` to set attribute values because it ensures `contributes` is set (if
        # `contributes` is not provided, `update` will derive it from the `values` value)
        self.update(
            hint=hint,
            contributes=contributes,
            values=values or [],
        )

    @property
    @abstractmethod
    def id(self) -> str: ...

    @property
    def name(self) -> str | None:
        return KNOWN_MAJOR_COMPONENT_NAMES.get(self.id)

    @property
    def key(self) -> str:
        return self.name or self.id

    @cached_property
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
        self, id: str, recursive: bool = False, only_contributing: bool = False
    ) -> BaseGroupingComponent[Any] | None:
        """
        Looks up a subcomponent by id and returns the first instance found, or `None` if no
        instances are found.

        Unless `recursive=True` is passed, only direct children (the components in `self.values`)
        are checked.

        By default, any matching result will be returned. To filter out non-contributing components,
        pass `only_contributing=True`. (Note that if a component has `contributes = True` but has a
        non-contributing ancestor, the component is not considered contributing for purposes of this
        method.)
        """
        return next(
            self.iter_subcomponents(
                id=id, recursive=recursive, only_contributing=only_contributing
            ),
            None,
        )

    def iter_subcomponents(
        self, id: str, recursive: bool = False, only_contributing: bool = False
    ) -> Iterator[BaseGroupingComponent[Any] | None]:
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

            # Ensure components which wrap primitives only ever have one child
            if len(values) > 0 and any(isinstance(value, (int, str)) for value in values):
                try:
                    assert (
                        len(values) == 1
                    ), f"Components which wrap primitives can wrap at most one value. Got {values}."
                except AssertionError as e:
                    if in_test_environment():
                        raise
                    sentry_sdk.capture_exception(e)

            self.values = values
        if contributes is not None:
            self.contributes = contributes

    def iter_values(self) -> Generator[str | int]:
        """
        Recursively walks the component tree, gathering literal values from contributing
        branches into a flat list.
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
    id: str = "context_line"


class ErrorTypeGroupingComponent(BaseGroupingComponent[str]):
    id: str = "type"


class ErrorValueGroupingComponent(BaseGroupingComponent[str]):
    id: str = "value"


class FilenameGroupingComponent(BaseGroupingComponent[str]):
    id: str = "filename"


class FunctionGroupingComponent(BaseGroupingComponent[str]):
    id: str = "function"


class ModuleGroupingComponent(BaseGroupingComponent[str]):
    id: str = "module"


class NSErrorDomainGroupingComponent(BaseGroupingComponent[str]):
    id: str = "domain"


class NSErrorCodeGroupingComponent(BaseGroupingComponent[int]):
    id: str = "code"


class NSErrorGroupingComponent(
    BaseGroupingComponent[NSErrorDomainGroupingComponent | NSErrorCodeGroupingComponent]
):
    id: str = "ns_error"


FrameGroupingComponentChild = (
    ContextLineGroupingComponent
    | FilenameGroupingComponent
    | FunctionGroupingComponent
    | ModuleGroupingComponent
)


class FrameGroupingComponent(BaseGroupingComponent[FrameGroupingComponentChild]):
    id: str = "frame"
    in_app: bool

    def __init__(
        self,
        values: Sequence[FrameGroupingComponentChild],
        in_app: bool,
        hint: str | None = None,
        contributes: bool | None = None,
    ):
        super().__init__(hint=hint, contributes=contributes, values=values)
        self.in_app = in_app


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
    frame_counts: Counter[str]
    reverse_when_serializing: bool = False

    def __init__(
        self,
        values: Sequence[FrameGroupingComponent] | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
    ):
        super().__init__(hint=hint, contributes=contributes, values=values)
        self.frame_counts = Counter()

    def as_dict(self) -> dict[str, Any]:
        result = super().as_dict()

        if self.reverse_when_serializing:
            result["values"].reverse()

        return result


def _get_exception_component_key(
    component: ExceptionGroupingComponent | ChainedExceptionGroupingComponent,
) -> str:
    key = component.id

    either_variant_has_contributing_stacktrace = (
        component.frame_counts["in_app_contributing_frames"] != 0
        or component.frame_counts["system_contributing_frames"] != 0
    )

    contributing_error_message = component.get_subcomponent(
        "value", recursive=True, only_contributing=True
    )
    contributing_error_type = component.get_subcomponent(
        "type", recursive=True, only_contributing=True
    )
    contributing_ns_error = component.get_subcomponent(
        "ns_error", recursive=True, only_contributing=True
    )

    # The ordering here reflects the precedence order of grouping methods, plus what counts as the
    # "main" method in cases where multiple components contribute. (For example, when we group on
    # stacktrace or message, the error type technically does contribute to grouping as well, but in
    # an explaining-it-to-humans sense, it's clearer - and close enough, given how infrequently type
    # is the only differentiator between two events - to just say we're grouping on stacktrace.)
    if either_variant_has_contributing_stacktrace:
        key += "_stacktrace"
    elif contributing_error_message:
        key += "_message"
    elif contributing_ns_error:
        key = key.replace("exception", "ns_error")
    elif contributing_error_type:
        key += "_type"

    return key


ExceptionGroupingComponentChildren = (
    ErrorTypeGroupingComponent
    | ErrorValueGroupingComponent
    | NSErrorGroupingComponent
    | StacktraceGroupingComponent
)


class ExceptionGroupingComponent(BaseGroupingComponent[ExceptionGroupingComponentChildren]):
    id: str = "exception"
    frame_counts: Counter[str]

    def __init__(
        self,
        values: Sequence[ExceptionGroupingComponentChildren] | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
        frame_counts: Counter[str] | None = None,
    ):
        super().__init__(hint=hint, contributes=contributes, values=values)
        self.frame_counts = frame_counts or Counter()

    @property
    def key(self) -> str:
        return _get_exception_component_key(self)

    def as_dict(self) -> dict[str, Any]:
        """
        Convert to a dictionary, first rearranging the values so they show up in the order we want
        in grouping info.

        TODO: Once we're fully transitioned off of the `newstyle:2023-01-11` config, this method can
        be deleted
        """
        ordered_values: Any = []

        for component_id in ["type", "value", "ns_error", "stacktrace"]:
            subcomponent = self.get_subcomponent(component_id)
            if subcomponent:
                ordered_values.append(subcomponent)

        self.values = ordered_values

        return super().as_dict()


class ChainedExceptionGroupingComponent(BaseGroupingComponent[ExceptionGroupingComponent]):
    id: str = "chained_exception"
    frame_counts: Counter[str]
    reverse_when_serializing: bool = False

    def __init__(
        self,
        values: Sequence[ExceptionGroupingComponent] | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
        frame_counts: Counter[str] | None = None,
    ):
        super().__init__(hint=hint, contributes=contributes, values=values)
        self.frame_counts = frame_counts or Counter()

    def as_dict(self) -> dict[str, Any]:
        result = super().as_dict()

        if self.reverse_when_serializing:
            result["values"].reverse()

        return result

    @property
    def key(self) -> str:
        return _get_exception_component_key(self)


class ThreadsGroupingComponent(BaseGroupingComponent[StacktraceGroupingComponent]):
    id: str = "threads"
    key: str = "thread_stacktrace"
    frame_counts: Counter[str]

    def __init__(
        self,
        values: Sequence[StacktraceGroupingComponent] | None = None,
        hint: str | None = None,
        contributes: bool | None = None,
        frame_counts: Counter[str] | None = None,
    ):
        super().__init__(hint=hint, contributes=contributes, values=values)
        self.frame_counts = frame_counts or Counter()


class CSPGroupingComponent(
    BaseGroupingComponent[SaltGroupingComponent | ViolationGroupingComponent | URIGroupingComponent]
):
    id: str = "csp"

    @property
    def key(self) -> str:
        key = "csp"
        local_script_violation = self.get_subcomponent("violation")
        url = self.get_subcomponent("uri")

        if local_script_violation and local_script_violation.contributes:
            key += "_local_script_violation"
        elif url and url.contributes:
            key += "_url"

        return key


class ExpectCTGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "expect_ct"


class ExpectStapleGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "expect_staple"


class HPKPGroupingComponent(
    BaseGroupingComponent[HostnameGroupingComponent | SaltGroupingComponent]
):
    id: str = "hpkp"


class TemplateGroupingComponent(
    BaseGroupingComponent[ContextLineGroupingComponent | FilenameGroupingComponent]
):
    id: str = "template"


ContributingComponent = (
    ChainedExceptionGroupingComponent
    | ExceptionGroupingComponent
    | StacktraceGroupingComponent
    | ThreadsGroupingComponent
    | CSPGroupingComponent
    | ExpectCTGroupingComponent
    | ExpectStapleGroupingComponent
    | HPKPGroupingComponent
    | MessageGroupingComponent
    | TemplateGroupingComponent
)


# Wrapper component used to link component trees to variants
class RootGroupingComponent(BaseGroupingComponent[ContributingComponent]):

    def __init__(
        self,
        variant_name: str,
        hint: str | None = None,
        contributes: bool | None = None,
        values: Sequence[ContributingComponent] | None = None,
    ):
        super().__init__(hint, contributes, values)
        self.variant_name = variant_name

    @property
    def id(self) -> str:
        return self.variant_name

    @property
    def key(self) -> str:
        variant_name = self.variant_name

        if not self.values:  # Insurance - shouldn't ever happen
            return variant_name

        # Variant root components which don't contribute won't have any contributing children, but
        # we can find the component which would be the contributing component, were the root
        # component itself contributing. Strategies are run in descending order of priority, and
        # added into `values` in order, so the highest-priority option will always be first.
        would_be_contributing_component = self.values[0]

        return would_be_contributing_component.key

    def __repr__(self) -> str:
        base_repr = super().__repr__()
        # Fake the class name so that instead of showing as `RootGroupingComponent` in the repr it
        # shows as `AppGroupingComponent`/`SystemGroupingComponent`/`DefaultGroupingComponent`
        return base_repr.replace("Root", self.id.title())
