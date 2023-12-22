from __future__ import annotations

import functools
import inspect
import os
import re
import sys
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
from typing import (
    Any,
    Callable,
    Collection,
    Dict,
    Iterable,
    List,
    Literal,
    MutableSet,
    Sequence,
    Set,
    Tuple,
    Type,
    cast,
)
from unittest import TestCase

import pytest
from django.apps import apps
from django.db.models import Model
from django.db.models.fields.related import RelatedField
from django.test import override_settings

from sentry import deletions
from sentry.api.utils import generate_region_url
from sentry.db.models.base import BaseModel, ModelSiloLimit
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.outboxes import ReplicatedControlModel, ReplicatedRegionModel
from sentry.deletions.base import BaseDeletionTask
from sentry.models.actor import Actor
from sentry.silo import SiloMode, match_fence_query
from sentry.testutils.region import get_test_env_directory, override_regions
from sentry.types.region import Region, RegionCategory
from sentry.utils.snowflake import SnowflakeIdMixin

TestMethod = Callable[..., None]

SENTRY_USE_MONOLITH_DBS = os.environ.get("SENTRY_USE_MONOLITH_DBS", "0") == "1"


def create_test_regions(*names: str, single_tenants: Iterable[str] = ()) -> tuple[Region, ...]:
    single_tenants = frozenset(single_tenants)
    return tuple(
        Region(
            name=name,
            snowflake_id=index + 1,
            address=generate_region_url(name),
            category=(
                RegionCategory.SINGLE_TENANT
                if name in single_tenants
                else RegionCategory.MULTI_TENANT
            ),
        )
        for (index, name) in enumerate(names)
    )


def _model_silo_limit(t: type[Model]) -> ModelSiloLimit:
    silo_limit = getattr(t._meta, "silo_limit", None)
    if not isinstance(silo_limit, ModelSiloLimit):
        raise ValueError(
            f"{t!r} is missing a silo limit, add a silo_model decorate to indicate its placement"
        )
    return silo_limit


class AncestorAlreadySiloDecoratedException(Exception):
    pass


def _get_test_name_suffix(silo_mode: SiloMode) -> str:
    name = silo_mode.name[0].upper() + silo_mode.name[1:].lower()
    return f"__In{name}Mode"


def strip_silo_mode_test_suffix(name: str) -> str:
    for silo_mode in SiloMode:
        suffix = _get_test_name_suffix(silo_mode)
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


class SiloModeTestDecorator:
    """Decorate a test case that is expected to work in a given silo mode.

    A test marked with a single silo mode runs only in that mode by default. An
    `include_monolith_run=True` will add a secondary run in monolith mode.

    If a test is marked with both control and region modes, then the primary run will
    be in monolith mode and a secondary run will be generated in each silo mode.

    When testing on more than one mode, if the decorator is on a test case class,
    an additional class is dynamically generated and added to the module for Pytest
    to pick up. For example, if you write

    ```
        @control_silo_test(include_monolith_run=True)
        class MyTest(TestCase):
            def setUp(self):      ...
            def test_stuff(self): ...
    ```

    then your result set should include test runs for both `MyTest` (in control mode)
    and `MyTest__InMonolithMode`.
    """

    def __init__(self, *silo_modes: SiloMode) -> None:
        self.silo_modes = frozenset(silo_modes)

    def __call__(
        self,
        decorated_obj: Any = None,
        *,
        regions: Sequence[Region] = (),
        include_monolith_run: bool = False,
    ) -> Any:
        silo_modes = self.silo_modes
        if include_monolith_run:
            silo_modes |= frozenset([SiloMode.MONOLITH])

        mod = _SiloModeTestModification(silo_modes=silo_modes, regions=tuple(regions))
        return mod.apply if decorated_obj is None else mod.apply(decorated_obj)


@dataclass(frozen=True)
class _SiloModeTestModification:
    """Encapsulate the set of changes made to a test class by a SiloModeTestDecorator."""

    silo_modes: frozenset[SiloMode]
    regions: tuple[Region, ...]

    def __post_init__(self) -> None:
        if not self.silo_modes:
            raise ValueError("silo_modes must not be empty")

    @contextmanager
    def test_config(self, silo_mode: SiloMode):
        with (
            override_regions(self.regions) if self.regions else nullcontext(),
            assume_test_silo_mode(silo_mode, can_be_monolith=False),
        ):
            yield

    def _create_overriding_test_class(
        self, test_class: Type[TestCase], silo_mode: SiloMode, name_suffix: str = ""
    ) -> Type[TestCase]:
        def override_method(method_name: str) -> Callable[..., Any]:
            context = self.test_config(silo_mode)
            method: Callable[..., Any] = getattr(test_class, method_name)
            return context(method)

        # Unfortunately, due to the way DjangoTestCase setup and app manipulation works, `override_settings` in a
        # run method produces unusual, broken results.  We're forced to wrap the hidden methods that invoke setup
        # test method in order to use override_settings correctly in django test cases.
        new_methods = {
            method_name: override_method(method_name)
            for method_name in ("_callSetUp", "_callTestMethod")
        }
        name = test_class.__name__ + name_suffix
        new_class = type(name, (test_class,), new_methods)
        return cast(Type[TestCase], new_class)

    def _arrange_silo_modes(self) -> tuple[SiloMode, Collection[SiloMode]]:
        """Select which silo modes will be tested by the original and dynamic classes.

        The return value is a (primary, secondary) pair. The "primary" silo mode is
        the one to be tested by the decorated class without changing its name. The
        "secondary" modes are tested by dynamically generated classes that are added
        to the module namespace.
        """
        if len(self.silo_modes) == 1:
            (only_mode,) = self.silo_modes
            return only_mode, ()
        non_monolith_modes = [m for m in self.silo_modes if m != SiloMode.MONOLITH]
        if len(non_monolith_modes) == 1:
            (other_mode,) = non_monolith_modes
            return other_mode, (SiloMode.MONOLITH,)
        else:
            return SiloMode.MONOLITH, non_monolith_modes

    def _add_siloed_test_classes_to_module(self, test_class: Type[TestCase]) -> Type[TestCase]:
        primary_mode, secondary_modes = self._arrange_silo_modes()

        for silo_mode in secondary_modes:
            siloed_test_class = self._create_overriding_test_class(
                test_class, silo_mode, _get_test_name_suffix(silo_mode)
            )

            module = sys.modules[test_class.__module__]
            setattr(module, siloed_test_class.__name__, siloed_test_class)

        # Return the value to be wrapped by the original decorator
        return self._create_overriding_test_class(test_class, primary_mode)

    def _mark_parameterized_by_silo_mode(self, test_method: TestMethod) -> TestMethod:
        def replacement_test_method(*args: Any, **kwargs: Any) -> None:
            silo_mode = kwargs.pop("silo_mode")
            with self.test_config(silo_mode):
                test_method(*args, **kwargs)

        orig_sig = inspect.signature(test_method)
        new_test_method = functools.update_wrapper(replacement_test_method, test_method)
        if "silo_mode" not in orig_sig.parameters:
            new_params = tuple(orig_sig.parameters.values()) + (
                inspect.Parameter("silo_mode", inspect.Parameter.KEYWORD_ONLY),
            )
            new_sig = orig_sig.replace(parameters=new_params)
            new_test_method.__setattr__("__signature__", new_sig)

        return pytest.mark.parametrize("silo_mode", self.silo_modes)(new_test_method)

    def apply(self, decorated_obj: Any) -> Any:
        is_test_case_class = isinstance(decorated_obj, type) and issubclass(decorated_obj, TestCase)
        is_function = inspect.isfunction(decorated_obj)

        if not (is_test_case_class or is_function):
            raise ValueError("@SiloModeTest must decorate a function or TestCase class")

        if is_test_case_class:
            self._validate_that_no_ancestor_is_silo_decorated(decorated_obj)
            # _silo_modes is used to mark the class as silo decorated in the above validation
            decorated_obj._silo_modes = self.silo_modes

        if SENTRY_USE_MONOLITH_DBS:
            # In this case, skip modifying the object and let it run in the default
            # silo mode (monolith)
            return decorated_obj

        if is_test_case_class:
            return self._add_siloed_test_classes_to_module(decorated_obj)

        return self._mark_parameterized_by_silo_mode(decorated_obj)

    def _validate_that_no_ancestor_is_silo_decorated(self, object_to_validate: Any):
        class_queue = [object_to_validate]

        # Do a breadth-first traversal of all base classes to ensure that the
        #  object does not inherit from a class which has already been decorated,
        #  even in multi-inheritance scenarios.
        while len(class_queue) > 0:
            current_class = class_queue.pop(0)
            if getattr(current_class, "_silo_modes", None):
                raise AncestorAlreadySiloDecoratedException(
                    f"Cannot decorate class '{object_to_validate.__name__}', which inherits from a silo decorated class"
                )
            class_queue.extend(current_class.__bases__)


all_silo_test = SiloModeTestDecorator(*SiloMode)
"""
Apply to test functions/classes to indicate that tests are
expected to pass in CONTROL, REGION and MONOLITH modes.
"""

no_silo_test = SiloModeTestDecorator(SiloMode.MONOLITH)
"""
Apply to test functions/classes to indicate that tests are
free of silo mode logic and hybrid cloud service usage.
"""

control_silo_test = SiloModeTestDecorator(SiloMode.CONTROL)
"""
Apply to test functions/classes to indicate that tests are
expected to pass with the current silo mode set to CONTROL.
"""

region_silo_test = SiloModeTestDecorator(SiloMode.REGION)
"""
Apply to test functions/classes to indicate that tests are
expected to pass with the current silo mode set to REGION.
"""


# assume_test_silo_mode vs assume_test_silo_mode_of: What's the difference?
#
# These two functions are similar ways to express the same thing. Generally,
# assume_test_silo_mode_of is preferable because it does more to communicate your
# intent and matches the style used by functions such as `router.db_for_write`. But
# assume_test_silo_mode is used in more places because it has existed longer.


@contextmanager
def assume_test_silo_mode(desired_silo: SiloMode, can_be_monolith: bool = True) -> Any:
    """Potential swap the silo mode in a test class or factory, useful for creating multi SiloMode models and executing
    test code in a special silo context.
    In monolith mode, this context manager has no effect.
    This context manager, should never be run outside of test contexts.  In fact, it depends on test code that will
    not exist in production!
    When run in either Region or Control silo modes, it forces the settings.SILO_MODE to the desired_silo.
    Notably, this won't be thread safe, so again, only use this in factories and test cases, not code, or you'll
    have a nightmare when your (threaded) acceptance tests bleed together and do whacky things :o)
    Use this in combination with factories or test setup code to create models that don't correspond with your
    given test mode.
    """
    # Only swapping the silo mode if we are already in a silo mode.
    if can_be_monolith and SiloMode.get_current_mode() == SiloMode.MONOLITH:
        desired_silo = SiloMode.MONOLITH

    with override_settings(SILO_MODE=desired_silo):
        if desired_silo == SiloMode.REGION:
            region_dir = get_test_env_directory()
            with region_dir.swap_to_default_region():
                yield
        elif desired_silo == SiloMode.MONOLITH:
            with override_settings(SENTRY_REGION=None):
                yield
        else:
            yield


@contextmanager
def assume_test_silo_mode_of(*models: Type[BaseModel], can_be_monolith: bool = True) -> Any:
    """Potentially swap to the silo mode to match the provided model classes.

    The argument should be one or more model classes that are scoped to exactly one
    non-monolith mode. That is, they must be tagged with `control_silo_only_model` or
    `region_silo_only_model`. The enclosed context is swapped into the appropriate
    mode, allowing the model to be accessed.

    If no silo-scoped models are provided, no mode swap is performed.

    The intent is that you list the cross-silo models that you intend to access
    within the block. However, this is for the sake of expressiveness only. The
    context will not actually check that you access only those models; it will allow
    you to access any model that happens to share the same silo mode.
    """

    def unpack_modes() -> Iterable[SiloMode]:
        for model in models:
            try:
                meta = getattr(model, "_meta")
            except AttributeError as e:
                raise ValueError(
                    f"Expected a model class with a _meta attribute: {model.__name__} did not have `_meta`"
                ) from e

            silo_limit: ModelSiloLimit | None = getattr(meta, "silo_limit", None)
            if silo_limit:
                yield from silo_limit.modes

    unique_modes = {mode for mode in unpack_modes() if mode != SiloMode.MONOLITH}
    if not unique_modes:
        yield
        return
    if len(unique_modes) > 1:
        model_names = [m.__name__ for m in models]
        raise ValueError(
            f"Models ({model_names!r}) don't share a unique silo mode ({unique_modes!r})"
        )
    (mode,) = unique_modes

    with assume_test_silo_mode(mode, can_be_monolith):
        yield


def protected_table(table: str, operation: str) -> re.Pattern:
    return re.compile(f'{operation}[^"]+"{table}"', re.IGNORECASE)


_protected_operations: List[re.Pattern] = []


def get_protected_operations() -> List[re.Pattern]:
    if len(_protected_operations):
        return _protected_operations

    # Protect Foreign Keys using hybrid cloud models from being deleted without using the
    # privileged user. Deletion should only occur when the developer is actively aware
    # of the need to generate outboxes.
    seen_models: MutableSet[type] = set()
    for app_config in apps.get_app_configs():
        for model in iter_models(app_config.name):
            for field in model._meta.fields:
                if not isinstance(field, HybridCloudForeignKey):
                    continue
                fk_model = field.foreign_model
                if fk_model is None or fk_model in seen_models:
                    continue
                seen_models.add(fk_model)
                _protected_operations.append(protected_table(fk_model._meta.db_table, "delete"))
            if issubclass(model, ReplicatedControlModel) or issubclass(
                model, ReplicatedRegionModel
            ):
                _protected_operations.append(protected_table(model._meta.db_table, "insert"))
                _protected_operations.append(protected_table(model._meta.db_table, "update"))
                _protected_operations.append(protected_table(model._meta.db_table, "delete"))

    # Protect inserts/updates that require outbox messages.
    _protected_operations.extend(
        [
            protected_table("sentry_user", "insert"),
            protected_table("sentry_user", "update"),
            protected_table("sentry_user", "delete"),
            protected_table("sentry_organizationmember", "insert"),
            protected_table("sentry_organizationmember", "update"),
            protected_table("sentry_organizationmember", "delete"),
            protected_table("sentry_organizationmembermapping", "insert"),
        ]
    )

    return _protected_operations


def validate_protected_queries(queries: Sequence[Dict[str, str]]) -> None:
    """
    Validate a list of queries to ensure that protected queries
    are wrapped in role_override fence values.

    See sentry.db.postgres.roles for where fencing queries come from.
    """
    context_queries = 5
    fence_depth = 0
    start_fence_index = 0

    for index, query in enumerate(queries):
        sql = query["sql"]
        # The real type of queries is Iterable[Dict[str, str | None]], due to some weird bugs in django which can result
        # in None sql query dicts.  However, typing the parameter that way breaks things due to a lack of covariance in
        # the VT TypeVar for Dict.
        if sql is None:
            continue  # type: ignore
        match = match_fence_query(sql)
        if match:
            operation = match.group("operation")
            if operation == "start":
                fence_depth += 1
                start_fence_index = index
            elif operation == "end":
                fence_depth = max(fence_depth - 1, 0)
            else:
                raise AssertionError("Invalid fencing operation encounted")

        for protected in get_protected_operations():
            if protected.match(sql) and fence_depth == 0:
                start = max(0, start_fence_index - context_queries)
                end = min(index + context_queries, len(queries))

                query_slice = queries[start:end]
                msg = [
                    "Found protected operation without explicit outbox escape!",
                    "",
                    sql,
                    "",
                    "Was not surrounded by role elevation queries, and could corrupt data if outboxes are not generated.",
                    "If you are confident that outboxes are being generated, wrap the "
                    "operation that generates this query with the `unguarded_write()` ",
                    "context manager to resolve this failure. For example:",
                    "",
                    "with unguarded_write(using=router.db_for_write(OrganizationMembership):",
                    "    member.delete()",
                    "",
                    "Query logs:",
                    "",
                ]
                for query in query_slice:
                    msg.append(query["sql"])
                    if query["sql"] == sql:
                        msg.append("^" * len(sql))

                raise AssertionError("\n".join(msg))


def iter_models(app_name: str | None = None) -> Iterable[Type[Model]]:
    for app, app_models in apps.all_models.items():
        if app == app_name or app_name is None:
            for model in app_models.values():
                if (
                    model.__module__.startswith("django.")
                    or "tests." in model.__module__
                    or "fixtures." in model.__module__
                ):
                    continue
                yield model


def validate_models_have_silos(exemptions: Set[Type[Model]], app_name: str | None = None) -> None:
    for model in iter_models(app_name):
        if model in exemptions:
            continue
        silo_limit = _model_silo_limit(model)
        if SiloMode.REGION not in silo_limit.modes and SiloMode.CONTROL not in silo_limit.modes:
            raise ValueError(
                f"{model!r} is marked as a pending model, but either needs a placement or an exemption in this test."
            )


def validate_no_cross_silo_foreign_keys(
    exemptions: Set[Tuple[Type[Model], Type[Model]]], app_name: str | None = None
) -> Set[Any]:
    seen: Set[Any] = set()
    for model in iter_models(app_name):
        seen |= validate_model_no_cross_silo_foreign_keys(model, exemptions)
    return seen


def validate_no_cross_silo_deletions(
    exemptions: Set[Tuple[Type[Model], Type[Model]]], app_name: str | None = None
) -> None:
    for model_class in iter_models(app_name):
        if not hasattr(model_class._meta, "silo_limit"):
            continue
        deletion_task: BaseDeletionTask = deletions.get(model=model_class, query={})
        for relation in deletion_task.get_child_relations(model_class()):
            to_model = relation.params["model"]
            if (model_class, to_model) in exemptions or (to_model, model_class) in exemptions:
                continue
            for mode in _model_silo_limit(model_class).modes:
                if mode not in _model_silo_limit(to_model).modes:
                    raise ValueError(
                        f"Deletions for {model_class!r} cascade to {to_model!r}, but does not belong to the same silo mode.  Please remove this relation from get_child_relations in deletions configuration"
                    )


def _is_relation_cross_silo(
    model: Type[Model] | Literal["self"],
    related: Type[Model] | Literal["self"],
) -> bool:
    if model == "self" or related == "self":
        return False
    for mode in _model_silo_limit(model).modes:
        if mode not in _model_silo_limit(related).modes:
            return True
    return False


def validate_relation_does_not_cross_silo_foreign_keys(
    model: Type[Model] | Literal["self"],
    related: Type[Model] | Literal["self"],
) -> None:
    if model == "self" or related == "self":
        return
    for mode in _model_silo_limit(model).modes:
        if mode not in _model_silo_limit(related).modes:
            raise ValueError(
                f"{model!r} runs in {mode}, but is related to {related!r} which does not.  Add this relationship pair as an exception or drop the foreign key."
            )


def validate_hcfk_has_global_id(model: Type[Model], related_model: Type[Model]):
    # HybridCloudForeignKey can point to region models if they have snowflake ids
    if issubclass(related_model, SnowflakeIdMixin):
        return

    # This particular relation is being removed before we go multi region.
    if related_model is Actor:
        return

    # but they cannot point to region models otherwise.
    if SiloMode.REGION in _model_silo_limit(related_model).modes:
        raise ValueError(
            f"{related_model!r} runs in {SiloMode.REGION}, but is related to {model!r} via a HybridCloudForeignKey! Region model ids are not global, unless you use a snowflake id."
        )


def validate_model_no_cross_silo_foreign_keys(
    model: Type[Model],
    exemptions: Set[Tuple[Type[Model], Type[Model]]],
) -> Set[Any]:
    from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

    seen: Set[Any] = set()
    for field in model._meta.fields:
        if isinstance(field, RelatedField):
            if (model, field.related_model) in exemptions:
                if _is_relation_cross_silo(model, field.related_model):
                    seen = seen | {(model, field.related_model)}
                    continue
            if (field.related_model, model) in exemptions:
                if _is_relation_cross_silo(field.related_model, model):
                    seen = seen | {(field.related_model, model)}
                    continue

            validate_relation_does_not_cross_silo_foreign_keys(model, field.related_model)
            validate_relation_does_not_cross_silo_foreign_keys(field.related_model, model)
        if isinstance(field, HybridCloudForeignKey):
            validate_hcfk_has_global_id(model, field.foreign_model)
    return seen
