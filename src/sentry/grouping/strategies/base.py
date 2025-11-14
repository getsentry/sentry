from __future__ import annotations

from collections.abc import Callable, Iterator, Sequence
from typing import TYPE_CHECKING, Any, Generic, Protocol, Self, TypeVar, overload, int

from sentry.grouping.component import (
    BaseGroupingComponent,
    ExceptionGroupingComponent,
    FrameGroupingComponent,
    StacktraceGroupingComponent,
)
from sentry.grouping.enhancer import (
    DEFAULT_ENHANCEMENTS_BASE,
    ENHANCEMENT_BASES,
    EnhancementsConfig,
)
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.fingerprinting import DEFAULT_GROUPING_FINGERPRINTING_BASES
from sentry.interfaces.base import Interface
from sentry.interfaces.exception import SingleException
from sentry.interfaces.stacktrace import Frame, Stacktrace

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


STRATEGIES: dict[str, Strategy[Any]] = {}


# XXX: Want to make ContextDict typeddict but also want to type/overload dict
# API on GroupingContext
ContextValue = Any
ContextDict = dict[str, ContextValue]


# TODO: Hack to make `ComponentsByVariant` covariant. At some point we should probably turn
# `ComponentsByVariant` into a Mapping (immutable), since in practice it's read-only.
GroupingComponent = TypeVar("GroupingComponent", bound=BaseGroupingComponent[Any])
ComponentsByVariant = dict[str, GroupingComponent]
ConcreteInterface = TypeVar("ConcreteInterface", bound=Interface, contravariant=True)


class StrategyFunc(Protocol[ConcreteInterface]):
    def __call__(
        self,
        interface: ConcreteInterface,
        event: Event,
        context: GroupingContext,
        **kwargs: Any,
    ) -> ComponentsByVariant: ...


class VariantProcessor(Protocol):
    def __call__(
        self, variants: ComponentsByVariant, context: GroupingContext, **kwargs: Any
    ) -> ComponentsByVariant: ...


def strategy(
    ids: Sequence[str],
    interface: type[Interface],
    score: int | None = None,
) -> Callable[[StrategyFunc[ConcreteInterface]], Strategy[ConcreteInterface]]:
    """
    Registers a strategy

    :param ids: The strategy/delegate IDs to register
    :param interface: Which interface type should be dispatched to this strategy
    :param score: Determines precedence of strategies. For example exception
        strategy scores higher than message strategy, so if both interfaces are
        in the event, only exception will be used for hash
    """

    name = interface.external_type

    if not ids:
        raise TypeError("no ids given")

    def decorator(f: StrategyFunc[ConcreteInterface]) -> Strategy[ConcreteInterface]:
        strategy_class: Strategy[ConcreteInterface] | None = None

        for id in ids:
            STRATEGIES[id] = strategy_class = Strategy(
                id=id, name=name, interface=interface.path, score=score, func=f
            )

        assert strategy_class is not None
        return strategy_class

    return decorator


class GroupingContext:
    """
    A key-value store used for passing state between strategy functions and other helpers used
    during grouping.

    Has a dictionary-like interface, along with a context manager which allows values to be
    temporarily overwritten:

        context = GroupingContext()
        context["some_key"] = "original_value"

        value_at_some_key = context["some_key"] # will be "original_value"
        value_at_some_key = context.get("some_key") # will be "original_value"

        value_at_another_key = context["another_key"] # will raise a KeyError
        value_at_another_key = context.get("another_key") # will be None
        value_at_another_key = context.get("another_key", "some_default") # will be "some_default"

        with context:
            context["some_key"] = "some_other_value"
            value_at_some_key = context["some_key"] # will be "some_other_value"

        value_at_some_key = context["some_key"] # will be "original_value"
    """

    def __init__(self, strategy_config: StrategyConfiguration, event: Event):
        # The initial context is essentially the grouping config options
        self._stack = [strategy_config.initial_context]
        self.config = strategy_config
        self.event = event
        self._push_context_layer()

    def __setitem__(self, key: str, value: ContextValue) -> None:
        # Add the key-value pair to the context layer at the top of the stack
        self._stack[-1][key] = value

    def __getitem__(self, key: str) -> ContextValue:
        # Walk down the stack from the top and return the first instance of `key` found
        for d in reversed(self._stack):
            if key in d:
                return d[key]
        raise KeyError(key)

    def get(self, key: str, default: ContextValue | None = None) -> ContextValue | None:
        try:
            return self[key]
        except KeyError:
            return default

    def __enter__(self) -> Self:
        self._push_context_layer()
        return self

    def __exit__(self, exc_type: type[Exception], exc_value: Exception, tb: Any) -> None:
        self._pop_context_layer()

    def _push_context_layer(self) -> None:
        self._stack.append({})

    def _pop_context_layer(self) -> None:
        self._stack.pop()

    def get_grouping_components_by_variant(
        self, interface: Interface, *, event: Event, **kwargs: Any
    ) -> ComponentsByVariant:
        """
        Called by a strategy to invoke delegates on its child interfaces.

        For example, the chained exception strategy calls this on the exceptions in the chain, and
        the exception strategy calls this on each exception's stacktrace.
        """
        return self._get_grouping_components_for_interface(interface, event=event, **kwargs)

    @overload
    def get_single_grouping_component(
        self, interface: Frame, *, event: Event, **kwargs: Any
    ) -> FrameGroupingComponent: ...

    @overload
    def get_single_grouping_component(
        self, interface: SingleException, *, event: Event, **kwargs: Any
    ) -> ExceptionGroupingComponent: ...

    @overload
    def get_single_grouping_component(
        self, interface: Stacktrace, *, event: Event, **kwargs: Any
    ) -> StacktraceGroupingComponent: ...

    def get_single_grouping_component(
        self, interface: Interface, *, event: Event, **kwargs: Any
    ) -> FrameGroupingComponent | ExceptionGroupingComponent | StacktraceGroupingComponent:
        """
        Invoke the delegate grouping strategy corresponding to the given interface, returning the
        grouping component for the variant set on the context.
        """
        variant_name = self["variant_name"]
        assert variant_name is not None

        components_by_variant = self._get_grouping_components_for_interface(
            interface, event=event, **kwargs
        )

        assert len(components_by_variant) == 1
        return components_by_variant[variant_name]

    def _get_grouping_components_for_interface(
        self, interface: Interface, *, event: Event, **kwargs: Any
    ) -> ComponentsByVariant:
        """
        Apply a delegate strategy to the given interface to get a dictionary of grouping components
        keyed by variant name.
        """
        interface_id = interface.path
        strategy = self.config.delegates.get(interface_id)

        if strategy is None:
            raise RuntimeError(f"No delegate strategy found for interface {interface_id}")

        kwargs["context"] = self
        kwargs["event"] = event

        components_by_variant = strategy(interface, **kwargs)
        assert isinstance(components_by_variant, dict)

        return components_by_variant


def lookup_strategy(strategy_id: str) -> Strategy[Any]:
    """Looks up a strategy by id."""
    try:
        return STRATEGIES[strategy_id]
    except KeyError:
        raise LookupError("Unknown strategy %r" % strategy_id)


class Strategy(Generic[ConcreteInterface]):
    """Base class for all strategies."""

    def __init__(
        self,
        id: str,
        name: str,
        interface: str,
        score: int | None,
        func: StrategyFunc[ConcreteInterface],
    ):
        self.id = id
        self.strategy_class = id.split(":", 1)[0]
        self.name = name
        self.interface_name = interface
        self.score = score
        self.func = func
        self.variant_processor_func: VariantProcessor | None = None

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.id!r}>"

    def _invoke(
        self, func: Callable[..., ComponentsByVariant], *args: Any, **kwargs: Any
    ) -> ComponentsByVariant:
        # We forcefully override strategy here. This lets a strategy
        # function always access its metadata and directly forward it to
        # subcomponents.
        kwargs["strategy"] = self
        return func(*args, **kwargs)

    def __call__(self, *args: Any, **kwargs: Any) -> ComponentsByVariant:
        return self._invoke(self.func, *args, **kwargs)

    def variant_processor(self, func: VariantProcessor) -> VariantProcessor:
        """Registers a variant reducer function that can be used to postprocess
        all variants created from this strategy.
        """
        self.variant_processor_func = func
        return func

    def get_grouping_components(
        self, event: Event, context: GroupingContext
    ) -> ComponentsByVariant:
        """
        Return a dictionary, keyed by variant name, of components produced by this strategy.
        """
        interface = event.interfaces.get(self.interface_name)

        if interface is None:
            return {}

        with context:
            components_by_variant = self(interface, event=event, context=context)

        final_components_by_variant = {}
        priority_contributing_variants_by_hash = {}
        non_priority_contributing_variants = []

        for variant_name, component in components_by_variant.items():
            is_priority = variant_name.startswith("!")
            variant_name = variant_name.lstrip("!")

            if component.contributes:
                # Track priority and non-priority contributing hashes separately, so the latter can
                # be deduped against the former
                if is_priority:
                    priority_contributing_variants_by_hash[component.get_hash()] = variant_name
                else:
                    non_priority_contributing_variants.append(variant_name)

            final_components_by_variant[variant_name] = component

        # Mark any non-priority duplicates of priority hashes as non-contributing
        for non_priority_variant_name in non_priority_contributing_variants:
            non_priority_component = final_components_by_variant[non_priority_variant_name]
            hash_value = non_priority_component.get_hash()
            matching_hash_variant_name = priority_contributing_variants_by_hash.get(hash_value)
            if matching_hash_variant_name is not None:
                non_priority_component.update(
                    contributes=False,
                    hint="ignored because hash matches %s variant" % matching_hash_variant_name,
                )

        if self.variant_processor_func is not None:
            final_components_by_variant = self._invoke(
                self.variant_processor_func,
                final_components_by_variant,
                event=event,
                context=context,
            )
        return final_components_by_variant


class StrategyConfiguration:
    id: str | None
    base: type[StrategyConfiguration] | None = None
    strategies: dict[str, Strategy[Any]] = {}
    delegates: dict[str, Strategy[Any]] = {}
    initial_context: ContextDict = {}
    enhancements_base: str | None = DEFAULT_ENHANCEMENTS_BASE
    fingerprinting_bases: Sequence[str] | None = DEFAULT_GROUPING_FINGERPRINTING_BASES

    def __init__(self, base64_enhancements: str | None = None):
        if base64_enhancements is None:
            enhancements_config = EnhancementsConfig.from_rules_text("", referrer="strategy_config")
        else:
            # If the enhancements string has been loaded from an existing event, it may be from an
            # obsolete enhancements version, in which case we just use the default enhancements for
            # this grouping config
            try:
                enhancements_config = EnhancementsConfig.from_base64_string(
                    base64_enhancements, referrer="strategy_config"
                )
            except InvalidEnhancerConfig:
                enhancements_config = ENHANCEMENT_BASES[
                    self.enhancements_base or DEFAULT_ENHANCEMENTS_BASE
                ]

        self.enhancements = enhancements_config

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} {self.id!r}>"

    def iter_strategies(self) -> Iterator[Strategy[Any]]:
        """Iterates over all strategies by highest score to lowest."""
        return iter(sorted(self.strategies.values(), key=lambda x: -x.score if x.score else 0))

    @classmethod
    def as_dict(cls) -> dict[str, Any]:
        return {
            "id": cls.id,
            "base": cls.base.id if cls.base else None,
            "strategies": sorted(cls.strategies),
            "delegates": sorted(x.id for x in cls.delegates.values()),
        }


def create_strategy_configuration_class(
    id: str,
    strategies: Sequence[str] | None = None,
    delegates: Sequence[str] | None = None,
    base: type[StrategyConfiguration] | None = None,
    initial_context: ContextDict | None = None,
    enhancements_base: str | None = None,
    fingerprinting_bases: Sequence[str] | None = None,
) -> type[StrategyConfiguration]:
    """Declares a new strategy configuration class.

    Values can be inherited from a base configuration.  For strategies if there is
    a strategy of the same class it's replaced.  For delegates if there is a
    delegation for the same interface it's replaced.

    It's impossible to remove a strategy of a class when a base is declared (same
    for delegates).
    """

    class NewStrategyConfiguration(StrategyConfiguration):
        pass

    NewStrategyConfiguration.id = id
    NewStrategyConfiguration.base = base
    NewStrategyConfiguration.strategies = dict(base.strategies) if base else {}
    NewStrategyConfiguration.delegates = dict(base.delegates) if base else {}
    NewStrategyConfiguration.initial_context = dict(base.initial_context) if base else {}
    NewStrategyConfiguration.enhancements_base = base.enhancements_base if base else None
    if base and base.fingerprinting_bases is not None:
        NewStrategyConfiguration.fingerprinting_bases = list(base.fingerprinting_bases)
    else:
        NewStrategyConfiguration.fingerprinting_bases = None

    by_class: dict[str, list[str]] = {}
    for strategy in NewStrategyConfiguration.strategies.values():
        by_class.setdefault(strategy.strategy_class, []).append(strategy.id)

    for strategy_id in strategies or {}:
        strategy = lookup_strategy(strategy_id)
        if strategy.score is None:
            raise RuntimeError(f"Unscored strategy {strategy_id} added to {id}")
        for old_id in by_class.get(strategy.strategy_class) or ():
            NewStrategyConfiguration.strategies.pop(old_id, None)
        NewStrategyConfiguration.strategies[strategy_id] = strategy

    new_delegates = set()
    for strategy_id in delegates or ():
        strategy = lookup_strategy(strategy_id)
        if strategy.interface_name in new_delegates:
            raise RuntimeError(
                "duplicate interface match for "
                "delegate %r (conflict on %r)" % (id, strategy.interface_name)
            )
        NewStrategyConfiguration.delegates[strategy.interface_name] = strategy
        new_delegates.add(strategy.interface_name)

    if initial_context:
        NewStrategyConfiguration.initial_context.update(initial_context)

    if enhancements_base:
        NewStrategyConfiguration.enhancements_base = enhancements_base

    if fingerprinting_bases:
        NewStrategyConfiguration.fingerprinting_bases = fingerprinting_bases

    NewStrategyConfiguration.__name__ = "StrategyConfiguration(%s)" % id
    return NewStrategyConfiguration


def produces_variants(
    variants: Sequence[str],
) -> Callable[[StrategyFunc[ConcreteInterface]], StrategyFunc[ConcreteInterface]]:
    """
    A grouping strategy can either:

    - be told by the caller which variant to generate
    - determine its own variants

    In the latter case, use this decorator to produce variants and eliminate
    duplicate hashes.

    Syntax::

        # call decorated function twice with different variant values
        # (returning a new variant dictionary)
        #
        # Return value is a dictionary of `{"system": ..., "app": ...}`.
        @produces_variants(["system", "app"])

        # discard app variant if system variant produces the same hash, or if
        # the function returned None when invoked with `context['variant'] ==
        # 'system'`. The actual logic for discarding is within
        # `Component.get_grouping_component_variants`, so hashes are compared
        # at the outermost level of the tree.
        #
        # Return value is a dictionary of `{"!system": ..., "app": ...}`,
        # however function is still called with `"system"` as
        # `context["variant_name"]`.
        @produces_variants(["!system", "app"])
    """

    def decorator(
        strategy_func: StrategyFunc[ConcreteInterface],
    ) -> StrategyFunc[ConcreteInterface]:
        def inner(*args: Any, **kwargs: Any) -> ComponentsByVariant:
            return call_with_variants(strategy_func, variants, *args, **kwargs)

        return inner

    return decorator


def call_with_variants(
    strategy_func: Callable[..., ComponentsByVariant],
    variants_to_produce: Sequence[str],
    *args: Any,
    **kwargs: Any,
) -> ComponentsByVariant:
    context = kwargs["context"]
    incoming_variant_name = context.get("variant_name")

    if incoming_variant_name is not None:
        # For the case where the variant is already determined, we act as a delegate strategy. To
        # ensure the function can deal with the given value, we assert the variant name is one
        # of our own.
        #
        # Note that this branch is not currently used by any strategies.
        assert (
            incoming_variant_name in variants_to_produce
            or "!" + incoming_variant_name in variants_to_produce
        )
        return strategy_func(*args, **kwargs)

    components_by_variant = {}

    for variant_name in variants_to_produce:
        with context:
            stripped_variant_name = variant_name.lstrip("!")
            context["variant_name"] = stripped_variant_name

            components_by_stripped_variant = strategy_func(*args, **kwargs)
            assert len(components_by_stripped_variant) == 1

            component = components_by_stripped_variant[stripped_variant_name]

        components_by_variant[variant_name] = component

    return components_by_variant
