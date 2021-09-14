import inspect
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    Generic,
    Iterator,
    List,
    Optional,
    Sequence,
    Type,
    TypeVar,
    Union,
)

import sentry_sdk

from sentry import projectoptions
from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.enhancer import Enhancements
from sentry.interfaces.base import Interface

STRATEGIES: Dict[str, "Strategy[Any]"] = {}

RISK_LEVEL_LOW = 0
RISK_LEVEL_MEDIUM = 1
RISK_LEVEL_HIGH = 2

Risk = int  # TODO: make enum or union of literals

# XXX: Want to make ContextDict typeddict but also want to type/overload dict
# API on GroupingContext
ContextValue = Any
ContextDict = Dict[str, ContextValue]

DEFAULT_GROUPING_ENHANCEMENTS_BASE = "common:2019-03-23"

ReturnedVariants = Dict[str, GroupingComponent]
ConcreteInterface = TypeVar("ConcreteInterface", bound=Interface, contravariant=True)

# TODO(3.8): This is a hack so we can get Protocols before 3.8
if TYPE_CHECKING:
    from typing_extensions import Protocol

    # XXX(markus): Too hard to mock out Protocol at runtime for as long as
    # we're not on 3.8, so let's just conditionally define all of our types.
    class StrategyFunc(Protocol[ConcreteInterface]):
        def __call__(
            self,
            interface: ConcreteInterface,
            event: Event,
            context: "GroupingContext",
            **meta: Any,
        ) -> ReturnedVariants:
            ...

    class VariantProcessor(Protocol):
        def __call__(
            self, variants: ReturnedVariants, context: "GroupingContext", **meta: Any
        ) -> ReturnedVariants:
            ...


def strategy(
    ids: Sequence[str],
    interface: Type[Interface],
    score: Optional[int] = None,
) -> Callable[["StrategyFunc[ConcreteInterface]"], "Strategy[ConcreteInterface]"]:
    """
    Registers a strategy

    :param ids: The strategy/delegate IDs with which to register
    :param interface: Which interface type should be dispatched to this strategy
    :param score: Determines precedence of strategies. For example exception
        strategy scores higher than message strategy, so if both interfaces are
        in the event, only exception will be used for hash
    """

    name = interface.path

    if not ids:
        raise TypeError("no ids given")

    def decorator(f: "StrategyFunc[ConcreteInterface]") -> Strategy[ConcreteInterface]:
        rv: Optional[Strategy[ConcreteInterface]] = None

        for id in ids:
            STRATEGIES[id] = rv = Strategy(
                id=id, name=name, interface=interface.path, score=score, func=f
            )

        assert rv is not None
        return rv

    return decorator


class GroupingContext:
    def __init__(self, strategy_config: "StrategyConfiguration"):
        self._stack = [strategy_config.initial_context]
        self.config = strategy_config
        self.push()
        self["variant"] = None

    def __setitem__(self, key: str, value: ContextValue) -> None:
        self._stack[-1][key] = value

    def __getitem__(self, key: str) -> ContextValue:
        for d in reversed(self._stack):
            if key in d:
                return d[key]
        raise KeyError(key)

    def __enter__(self) -> "GroupingContext":
        self.push()
        return self

    def __exit__(self, exc_type: Type[Exception], exc_value: Exception, tb: Any) -> None:
        self.pop()

    def push(self) -> None:
        self._stack.append({})

    def pop(self) -> None:
        self._stack.pop()

    def get_grouping_component(
        self, interface: Interface, *, event: Event, **kwargs: Any
    ) -> Union[GroupingComponent, ReturnedVariants]:
        """Invokes a delegate grouping strategy.  If no such delegate is
        configured a fallback grouping component is returned.
        """
        path = interface.path
        strategy = self.config.delegates.get(path)
        if strategy is None:
            raise RuntimeError(f"failed to dispatch interface {path} to strategy")

        kwargs["context"] = self
        kwargs["event"] = event
        with sentry_sdk.start_span(
            op="sentry.grouping.GroupingContext.get_grouping_component", description=path
        ):
            rv = strategy(interface, **kwargs)
        assert isinstance(rv, dict)

        if self["variant"] is not None:
            assert len(rv) == 1
            return rv[self["variant"]]

        return rv


def lookup_strategy(strategy_id: str) -> "Strategy[Any]":
    """Looks up a strategy by id."""
    try:
        return STRATEGIES[strategy_id]
    except KeyError:
        raise LookupError("Unknown strategy %r" % strategy_id)


class Strategy(Generic[ConcreteInterface]):
    """Baseclass for all strategies."""

    def __init__(
        self,
        id: str,
        name: str,
        interface: str,
        score: Optional[int],
        func: "StrategyFunc[ConcreteInterface]",
    ):
        self.id = id
        self.strategy_class = id.split(":", 1)[0]
        self.name = name
        self.interface = interface
        self.score = score
        self.func = func
        self.variant_processor_func: Optional["VariantProcessor"] = None

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.id!r}>"

    def _invoke(
        self, func: Callable[..., ReturnedVariants], *args: Any, **kwargs: Any
    ) -> ReturnedVariants:
        # We forcefully override strategy here.  This lets a strategy
        # function always access its metadata and directly forward it to
        # subcomponents without having to filter out strategy.
        kwargs["strategy"] = self
        return func(*args, **kwargs)

    def __call__(self, *args: Any, **kwargs: Any) -> ReturnedVariants:
        return self._invoke(self.func, *args, **kwargs)

    def variant_processor(self, func: "VariantProcessor") -> "VariantProcessor":
        """Registers a variant reducer function that can be used to postprocess
        all variants created from this strategy.
        """
        self.variant_processor_func = func
        return func

    def get_grouping_component(
        self, event: Event, context: GroupingContext, variant: Optional[str] = None
    ) -> Union[None, GroupingComponent, ReturnedVariants]:
        """Given a specific variant this calculates the grouping component."""
        args = []
        iface = event.interfaces.get(self.interface)
        if iface is None:
            return None
        args.append(iface)
        with context:
            # If a variant is passed put it into the context
            if variant is not None:
                context["variant"] = variant
            return self(event=event, context=context, *args)

    def get_grouping_component_variants(
        self, event: Event, context: GroupingContext
    ) -> ReturnedVariants:
        """This returns a dictionary of all components by variant that this
        strategy can produce.
        """

        # strategy can decide on its own which variants to produce and which contribute
        variants = self.get_grouping_component(event, variant=None, context=context)
        if variants is None:
            return {}

        assert isinstance(variants, dict)

        rv = {}
        has_mandatory_hashes = False
        mandatory_contributing_hashes = {}
        optional_contributing_variants = []
        prevent_contribution = None

        for variant, component in variants.items():
            is_mandatory = variant[:1] == "!"
            variant = variant.lstrip("!")

            if is_mandatory:
                has_mandatory_hashes = True

            if component.contributes:
                if is_mandatory:
                    mandatory_contributing_hashes[component.get_hash()] = variant
                else:
                    optional_contributing_variants.append(variant)

            rv[variant] = component

        prevent_contribution = has_mandatory_hashes and not mandatory_contributing_hashes

        for variant in optional_contributing_variants:
            component = rv[variant]

            # In case this variant contributes we need to check two things
            # here: if we did not have a system match we need to prevent
            # it from contributing.  Additionally if it matches the system
            # component we also do not want the variant to contribute but
            # with a different message.
            if prevent_contribution:
                component.update(
                    contributes=False,
                    hint="ignored because %s variant is not used"
                    % (
                        list(mandatory_contributing_hashes.values())[0]
                        if len(mandatory_contributing_hashes) == 1
                        else "other mandatory"
                    ),
                )
            else:
                hash = component.get_hash()
                duplicate_of = mandatory_contributing_hashes.get(hash)
                if duplicate_of is not None:
                    component.update(
                        contributes=False,
                        hint="ignored because hash matches %s variant" % duplicate_of,
                    )

        if self.variant_processor_func is not None:
            rv = self._invoke(self.variant_processor_func, rv, event=event, context=context)
        return rv


class StrategyConfiguration:
    id: Optional[str] = None
    base: Optional[Type["StrategyConfiguration"]] = None
    config_class = None
    strategies: Dict[str, Strategy[Any]] = {}
    delegates: Dict[str, Strategy[Any]] = {}
    changelog: Optional[str] = None
    hidden = False
    risk = RISK_LEVEL_LOW
    initial_context: ContextDict = {}
    enhancements_base: Optional[str] = DEFAULT_GROUPING_ENHANCEMENTS_BASE

    def __init__(self, enhancements: Optional[str] = None, **extra: Any):
        if enhancements is None:
            enhancements_instance = Enhancements([])
        else:
            enhancements_instance = Enhancements.loads(enhancements)
        self.enhancements = enhancements_instance

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} {self.id!r}>"

    def iter_strategies(self) -> Iterator[Strategy[Any]]:
        """Iterates over all strategies by highest score to lowest."""
        return iter(sorted(self.strategies.values(), key=lambda x: x.score and -x.score or 0))

    @classmethod
    def as_dict(cls) -> Dict[str, Any]:
        return {
            "id": cls.id,
            "base": cls.base.id if cls.base else None,
            "strategies": sorted(cls.strategies),
            "changelog": cls.changelog,
            "delegates": sorted(x.id for x in cls.delegates.values()),
            "hidden": cls.hidden,
            "risk": cls.risk,
            "latest": projectoptions.lookup_well_known_key("sentry:grouping_config").get_default(
                epoch=projectoptions.LATEST_EPOCH
            )
            == cls.id,
        }


def create_strategy_configuration(
    id: str,
    strategies: Optional[Sequence[str]] = None,
    delegates: Optional[Sequence[str]] = None,
    changelog: Optional[str] = None,
    hidden: bool = False,
    base: Optional[Type[StrategyConfiguration]] = None,
    risk: Optional[Risk] = None,
    initial_context: Optional[ContextDict] = None,
    enhancements_base: Optional[str] = None,
) -> Type[StrategyConfiguration]:
    """Declares a new strategy configuration.

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
    if risk is None:
        risk = RISK_LEVEL_LOW
    NewStrategyConfiguration.risk = risk
    NewStrategyConfiguration.hidden = hidden

    by_class: Dict[str, List[str]] = {}
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
        if strategy.interface in new_delegates:
            raise RuntimeError(
                "duplicate interface match for "
                "delegate %r (conflict on %r)" % (id, strategy.interface)
            )
        NewStrategyConfiguration.delegates[strategy.interface] = strategy
        new_delegates.add(strategy.interface)

    if initial_context:
        NewStrategyConfiguration.initial_context.update(initial_context)

    if enhancements_base:
        NewStrategyConfiguration.enhancements_base = enhancements_base

    NewStrategyConfiguration.changelog = inspect.cleandoc(changelog or "")
    NewStrategyConfiguration.__name__ = "StrategyConfiguration(%s)" % id
    return NewStrategyConfiguration


def produces_variants(
    variants: Sequence[str],
) -> Callable[["StrategyFunc[ConcreteInterface]"], "StrategyFunc[ConcreteInterface]"]:
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
        # `context["variant"]`.
        @produces_variants(["!system", "app"])
    """

    def decorator(f: "StrategyFunc[ConcreteInterface]") -> "StrategyFunc[ConcreteInterface]":
        def inner(*args: Any, **kwargs: Any) -> ReturnedVariants:
            return call_with_variants(f, variants, *args, **kwargs)

        return inner

    return decorator


def call_with_variants(
    f: Callable[..., ReturnedVariants], variants: Sequence[str], *args: Any, **kwargs: Any
) -> ReturnedVariants:
    context = kwargs["context"]
    if context["variant"] is not None:
        # For the case where the variant is already determined, we act as a
        # delegate strategy.
        #
        # To ensure the function can deal with the particular value we assert
        # the variant name is one of our own though.
        assert context["variant"] in variants or "!" + context["variant"] in variants
        return f(*args, **kwargs)

    rv = {}

    for variant in variants:
        with context:
            context["variant"] = variant.lstrip("!")
            rv_variants = f(*args, **kwargs)
            assert len(rv_variants) == 1
            component = rv_variants[variant.lstrip("!")]

        if component is None:
            continue

        rv[variant] = component

    return rv
