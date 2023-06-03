from __future__ import annotations

import functools
import inspect
from contextlib import contextmanager
from typing import Any, Callable, Generator, Iterable, Set, Tuple, Type, cast
from unittest import TestCase

import pytest
from django.db import connections, router
from django.db.models import Model
from django.db.models.fields.related import RelatedField
from django.test import override_settings

from sentry import deletions
from sentry.db.models.base import ModelSiloLimit
from sentry.deletions.base import BaseDeletionTask
from sentry.silo import SiloMode
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory

TestMethod = Callable[..., None]

region_map = [
    Region("na", 1, "http://na.testserver", RegionCategory.MULTI_TENANT),
    Region("eu", 2, "http://eu.testserver", RegionCategory.MULTI_TENANT),
    Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
]


def _model_silo_limit(t: type[Model]) -> ModelSiloLimit:
    silo_limit = getattr(t._meta, "silo_limit", None)
    if not isinstance(silo_limit, ModelSiloLimit):
        raise ValueError(
            f"{t!r} is missing a silo limit, add a silo_model decorate to indicate its placement"
        )
    return silo_limit


class SiloModeTest:
    """Decorate a test case that is expected to work in a given silo mode.

    Tests marked to work in monolith mode are always executed.
    Tests marked additionally to work in silo or control mode only do so when the test is marked as stable=True
    """

    def __init__(self, *silo_modes: SiloMode) -> None:
        self.silo_modes = frozenset(silo_modes)

    @staticmethod
    def _find_all_test_methods(test_class: type) -> Iterable[TestMethod]:
        for attr_name in dir(test_class):
            if attr_name.startswith("test_") or attr_name == "test":
                attr = getattr(test_class, attr_name)
                if callable(attr):
                    yield attr

    def _is_acceptance_test(self, test_class: type) -> bool:
        from sentry.testutils import AcceptanceTestCase

        return issubclass(test_class, AcceptanceTestCase)

    def _create_mode_methods(
        self, test_class: type, test_method: TestMethod
    ) -> Iterable[Tuple[str, TestMethod]]:
        def method_for_mode(mode: SiloMode) -> Iterable[Tuple[str, TestMethod]]:
            def replacement_test_method(*args: Any, **kwargs: Any) -> None:
                with override_settings(
                    SILO_MODE=mode,
                    SINGLE_SERVER_SILO_MODE=self._is_acceptance_test(test_class),
                    SENTRY_SUBNET_SECRET="secret",
                    SENTRY_CONTROL_ADDRESS="http://controlserver/",
                ):
                    with override_regions(region_map):
                        if mode == SiloMode.REGION:
                            with override_settings(SENTRY_REGION="na"):
                                test_method(*args, **kwargs)
                        else:
                            test_method(*args, **kwargs)

            functools.update_wrapper(replacement_test_method, test_method)
            modified_name = f"{test_method.__name__}__in_{str(mode).lower()}_silo"
            replacement_test_method.__name__ = modified_name
            yield modified_name, replacement_test_method

        for mode in self.silo_modes:
            # Currently, test classes that are decorated already handle the monolith mode as the default
            # because the original test method remains -- this is different from the pytest variant
            # that actually strictly parameterizes the existing test.  This reduces a redundant run of MONOLITH
            # mode.
            if mode == SiloMode.MONOLITH:
                continue
            yield from method_for_mode(mode)

    def _add_silo_modes_to_methods(self, test_class: type) -> type:
        for test_method in self._find_all_test_methods(test_class):
            for (new_method_name, new_test_method) in self._create_mode_methods(
                test_class, test_method
            ):
                setattr(test_class, new_method_name, new_test_method)
        return test_class

    def __call__(self, decorated_obj: Any = None, stable: bool = False) -> Any:
        if decorated_obj:
            return self._call(decorated_obj, stable)

        def receive_decorated_obj(f: Any) -> Any:
            return self._call(f, stable)

        return receive_decorated_obj

    def _mark_parameterized_by_silo_mode(self, test_method: TestMethod) -> TestMethod:
        def replacement_test_method(*args: Any, **kwargs: Any) -> None:
            silo_mode = kwargs.pop("silo_mode")
            with override_settings(SILO_MODE=silo_mode):
                with override_regions(region_map):
                    if silo_mode == SiloMode.REGION:
                        with override_settings(SENTRY_REGION="na"):
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
        return cast(
            TestMethod,
            pytest.mark.parametrize("silo_mode", sorted(self.silo_modes, key=str))(new_test_method),
        )

    def _call(self, decorated_obj: Any, stable: bool) -> Any:
        is_test_case_class = isinstance(decorated_obj, type) and issubclass(decorated_obj, TestCase)
        is_function = inspect.isfunction(decorated_obj)

        if not (is_test_case_class or is_function):
            raise ValueError("@SiloModeTest must decorate a function or TestCase class")

        # Only run non monolith tests when they are marked stable or we are explicitly running for that mode.
        if not stable:
            # In this case, simply force the current silo mode (monolith)
            return decorated_obj

        if is_test_case_class:
            return self._add_silo_modes_to_methods(decorated_obj)

        return self._mark_parameterized_by_silo_mode(decorated_obj)


all_silo_test = SiloModeTest(SiloMode.CONTROL, SiloMode.REGION, SiloMode.MONOLITH)
no_silo_test = SiloModeTest(SiloMode.MONOLITH)
control_silo_test = SiloModeTest(SiloMode.CONTROL, SiloMode.MONOLITH)
region_silo_test = SiloModeTest(SiloMode.REGION, SiloMode.MONOLITH)


@contextmanager
def exempt_from_silo_limits() -> Generator[None, None, None]:
    """Exempt test setup code from silo mode checks.

    This can be used to decorate functions that are used exclusively in setting
    up test cases, so that those functions don't produce false exceptions from
    writing to tables that wouldn't be allowed in a certain SiloModeTest case.

    It can also be used as a context manager to enclose setup code within a test
    method. Such setup code would ideally be moved to the test class's `setUp`
    method or a helper function where possible, but this is available as a
    kludge when that's too inconvenient. For example:

    ```
    @SiloModeTest(SiloMode.REGION)
    class MyTest(TestCase):
        def test_something(self):
            with exempt_from_mode_limits():
                org = self.create_organization()  # would be wrong if under test
            do_something(org)  # the actual code under test
    ```
    """
    with override_settings(SILO_MODE=SiloMode.MONOLITH):
        yield


def reset_test_role(role: str) -> None:
    with connections["default"].cursor() as connection:
        connection.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [role])
        if connection.fetchone():
            connection.execute(f"REASSIGN OWNED BY {role} TO postgres")
            connection.execute(f"DROP OWNED BY {role} CASCADE")
            connection.execute(f"DROP ROLE {role}")
        connection.execute(f"CREATE ROLE {role}")
        connection.execute(f"GRANT USAGE ON SCHEMA public TO {role};")
        connection.execute(f"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {role};")
        connection.execute(f"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {role};")


def restrict_role_by_silo(mode: SiloMode, role: str) -> None:
    for model in iter_models():
        silo_limit = getattr(model._meta, "silo_limit", None)
        if silo_limit is None or mode not in silo_limit.modes:
            restrict_role(role, model, "ALL PRIVILEGES")


def restrict_role(role: str, model: Any, revocation_type: str) -> None:
    using = router.db_for_write(model)
    with connections[using].cursor() as connection:
        connection.execute(f"REVOKE {revocation_type} ON public.{model._meta.db_table} FROM {role}")


def iter_models(app_name: str | None = None) -> Iterable[Type[Model]]:
    from django.apps import apps

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
    return seen
