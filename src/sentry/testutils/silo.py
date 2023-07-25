from __future__ import annotations

import functools
import inspect
import re
import sys
import unittest.result
from contextlib import contextmanager
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    List,
    MutableMapping,
    MutableSet,
    Sequence,
    Set,
    Tuple,
    Type,
)
from unittest import TestCase

import pytest
from django.apps import apps
from django.conf import settings
from django.db.models import Model
from django.db.models.fields.related import RelatedField
from django.test import override_settings

from sentry import deletions
from sentry.db.models.base import ModelSiloLimit
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.deletions.base import BaseDeletionTask
from sentry.models import Actor, NotificationSetting
from sentry.silo import SiloMode, match_fence_query
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory
from sentry.utils.snowflake import SnowflakeIdMixin

TestMethod = Callable[..., None]

_DEFAULT_TEST_REGIONS = (
    Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
    Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
    Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
)


def _model_silo_limit(t: type[Model]) -> ModelSiloLimit:
    silo_limit = getattr(t._meta, "silo_limit", None)
    if not isinstance(silo_limit, ModelSiloLimit):
        raise ValueError(
            f"{t!r} is missing a silo limit, add a silo_model decorate to indicate its placement"
        )
    return silo_limit


class _SiloModeTestCase(TestCase):
    """A test case that is expected to work in a particular silo mode.

    This class is meant to be extended by test cases tagged with a
    SiloModeTestDecorator. It should not be declared explicitly as a superclass,
    but is used to dynamically generate a new test case class (see
    SiloModeTestDecorator._add_siloed_test_classes_to_module).

    The subclass will apply the silo mode context to the entire test run, including
    setup.
    """

    # Expect these class-level attributes to be set when a subclass is
    # dynamically generated
    silo_mode: SiloMode
    regions: Sequence[Region]
    is_acceptance_test: bool

    def run(
        self, result: unittest.result.TestResult | None = None
    ) -> unittest.result.TestResult | None:
        with override_settings(
            SILO_MODE=self.silo_mode,
            SINGLE_SERVER_SILO_MODE=self.is_acceptance_test,
            SENTRY_SUBNET_SECRET="secret",
            SENTRY_CONTROL_ADDRESS="http://controlserver/",
        ):
            with override_regions(self.regions):
                if self.silo_mode == SiloMode.REGION:
                    with override_settings(SENTRY_REGION=self.regions[0].name):
                        return super().run(result)
                else:
                    with override_settings(SENTRY_MONOLITH_REGION=self.regions[0].name):
                        return super().run(result)


class SiloModeTestDecorator:
    """Decorate a test case that is expected to work in a given silo mode.

    Tests marked to work in monolith mode are always executed.
    Tests marked additionally to work in region or control mode only do so when the test is marked as stable=True

    When testing in a silo mode, if the decorator is on a test case class,
    an additional class is dynamically generated and added to the module for Pytest
    to pick up. For example, if you write

    ```
        @control_silo_test(stable=True)
        class MyTest(TestCase):
            def setUp(self):      ...
            def test_stuff(self): ...
    ```

    then your result set should include test runs for both `MyTest` (in monolith
    mode) and `MyTest__InControlMode`.
    """

    def __init__(self, *silo_modes: SiloMode) -> None:
        self.silo_modes = frozenset(sm for sm in silo_modes if sm != SiloMode.MONOLITH)

    @staticmethod
    def _is_acceptance_test(test_class: type) -> bool:
        from sentry.testutils import AcceptanceTestCase

        return issubclass(test_class, AcceptanceTestCase)

    def _add_siloed_test_classes_to_module(
        self, test_class: type, regions: Sequence[Region] | None
    ) -> type:
        is_acceptance_test = self._is_acceptance_test(test_class)

        def create_overriding_test_class(name: str, silo_mode: SiloMode) -> type:
            return type(
                name,
                (test_class, _SiloModeTestCase),
                {
                    "silo_mode": silo_mode,
                    "regions": tuple(regions or _DEFAULT_TEST_REGIONS),
                    "is_acceptance_test": is_acceptance_test,
                },
            )

        for silo_mode in self.silo_modes:
            silo_mode_name = silo_mode.name[0].upper() + silo_mode.name[1:].lower()
            siloed_test_class = create_overriding_test_class(
                f"{test_class.__name__}__In{silo_mode_name}Mode", silo_mode
            )

            module = sys.modules[test_class.__module__]
            setattr(module, siloed_test_class.__name__, siloed_test_class)

        # Return the value to be wrapped by the original decorator
        if regions is None:
            # Pass the original class through, with no modification
            return test_class
        else:
            # Override without changing the original name. We don't need to change
            # the silo mode, but we do need to override the region config.
            return create_overriding_test_class(test_class.__name__, SiloMode.MONOLITH)

    def __call__(
        self,
        decorated_obj: Any = None,
        stable: bool = False,
        regions: Sequence[Region] | None = None,
    ) -> Any:
        if decorated_obj:
            return self._call(decorated_obj, stable, regions)

        def receive_decorated_obj(f: Any) -> Any:
            return self._call(f, stable, regions)

        return receive_decorated_obj

    def _mark_parameterized_by_silo_mode(
        self, test_method: TestMethod, regions: Sequence[Region] | None
    ) -> TestMethod:
        regions = tuple(regions or _DEFAULT_TEST_REGIONS)

        def replacement_test_method(*args: Any, **kwargs: Any) -> None:
            silo_mode = kwargs.pop("silo_mode")
            with override_settings(SILO_MODE=silo_mode):
                with override_regions(regions):
                    if silo_mode == SiloMode.REGION:
                        with override_settings(SENTRY_REGION=regions[0].name):
                            test_method(*args, **kwargs)
                    else:
                        test_method(*args, **kwargs)

        orig_sig = inspect.signature(test_method)
        new_test_method = functools.update_wrapper(replacement_test_method, test_method)
        if "silo_mode" not in orig_sig.parameters:
            new_params = tuple(orig_sig.parameters.values()) + (
                inspect.Parameter("silo_mode", inspect.Parameter.KEYWORD_ONLY),
            )
            new_sig = orig_sig.replace(parameters=new_params)
            new_test_method.__setattr__("__signature__", new_sig)
        return pytest.mark.parametrize("silo_mode", sorted(self.silo_modes, key=str))(
            new_test_method
        )

    def _call(self, decorated_obj: Any, stable: bool, regions: Sequence[Region] | None) -> Any:
        is_test_case_class = isinstance(decorated_obj, type) and issubclass(decorated_obj, TestCase)
        is_function = inspect.isfunction(decorated_obj)

        if not (is_test_case_class or is_function):
            raise ValueError("@SiloModeTest must decorate a function or TestCase class")

        # Only run non monolith tests when they are marked stable or we are explicitly running for that mode.
        if not (stable or settings.FORCE_SILOED_TESTS):
            # In this case, simply force the current silo mode (monolith)
            return decorated_obj

        if is_test_case_class:
            return self._add_siloed_test_classes_to_module(decorated_obj, regions)

        return self._mark_parameterized_by_silo_mode(decorated_obj, regions)


all_silo_test = SiloModeTestDecorator(SiloMode.CONTROL, SiloMode.REGION)
no_silo_test = SiloModeTestDecorator()
control_silo_test = SiloModeTestDecorator(SiloMode.CONTROL)
region_silo_test = SiloModeTestDecorator(SiloMode.REGION)


@contextmanager
def assume_test_silo_mode(desired_silo: SiloMode) -> Any:
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
    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        desired_silo = SiloMode.MONOLITH

    overrides: MutableMapping[str, Any] = {}
    if desired_silo != SiloMode.get_current_mode():
        overrides["SILO_MODE"] = desired_silo
    if desired_silo == SiloMode.REGION and not getattr(settings, "SENTRY_REGION"):
        overrides["SENTRY_REGION"] = "na"

    if overrides:
        with override_settings(**overrides):
            yield
    else:
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

    # Protect inserts/updates that require outbox messages.
    _protected_operations.extend(
        [
            protected_table("sentry_organizationmember", "insert"),
            protected_table("sentry_organizationmember", "update"),
            protected_table("sentry_organizationmember", "delete"),
            protected_table("sentry_organization", "insert"),
            protected_table("sentry_organization", "update"),
            protected_table("sentry_organizationmapping", "insert"),
            protected_table("sentry_organizationmapping", "update"),
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
    model: Type[Model],
    related: Type[Model],
) -> bool:
    for mode in _model_silo_limit(model).modes:
        if mode not in _model_silo_limit(related).modes:
            return True
    return False


def validate_relation_does_not_cross_silo_foreign_keys(
    model: Type[Model],
    related: Type[Model],
) -> None:
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
    if related_model is Actor and model is NotificationSetting:
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
