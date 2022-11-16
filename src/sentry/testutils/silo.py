from __future__ import annotations

import functools
import inspect
from contextlib import contextmanager
from typing import Any, Callable, Generator, Iterable, Tuple, cast
from unittest import TestCase

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.silo import SiloMode
from sentry.testutils.region import override_regions
from sentry.types.region import Region, RegionCategory

TestMethod = Callable[..., None]

region_map = [
    Region("north_america", 1, "na.sentry.io", RegionCategory.MULTI_TENANT),
    Region("europe", 2, "eu.sentry.io", RegionCategory.MULTI_TENANT),
    Region("acme-single-tenant", 3, "acme.my.sentry.io", RegionCategory.SINGLE_TENANT),
]


class SiloModeTest:
    """Decorate a test case that is expected to work in a given silo mode.

    Tests marked to work in monolith mode are always executed.
    Tests marked additionally to work in silo or control mode only do so when either
    1. the test is marked as stable=True
    2. the test is being run with SILO_MODE_UNSTABLE_TESTS=1
    """

    def __init__(self, *silo_modes: SiloMode) -> None:
        self.silo_modes = frozenset(silo_modes)
        self.run_unstable_tests = bool(settings.SILO_MODE_UNSTABLE_TESTS)

    @staticmethod
    def _find_all_test_methods(test_class: type) -> Iterable[Tuple[str, TestMethod]]:
        for attr_name in dir(test_class):
            if attr_name.startswith("test_") or attr_name == "test":
                attr = getattr(test_class, attr_name)
                if callable(attr):
                    yield attr_name, attr

    def _create_mode_methods(self, test_method: TestMethod) -> Iterable[Tuple[str, TestMethod]]:
        def method_for_mode(mode: SiloMode) -> Iterable[Tuple[str, TestMethod]]:
            def replacement_test_method(*args: Any, **kwargs: Any) -> None:
                with override_settings(SILO_MODE=mode):
                    with override_regions(region_map):
                        if mode == SiloMode.REGION:
                            with override_settings(SENTRY_REGION="north_america"):
                                test_method(*args, **kwargs)
                        else:
                            test_method(*args, **kwargs)

            functools.update_wrapper(replacement_test_method, test_method)
            modified_name = f"{test_method.__name__}__in_{str(mode).lower()}_silo"
            replacement_test_method.__name__ = modified_name
            yield modified_name, replacement_test_method

        for mode in self.silo_modes:
            yield from method_for_mode(mode)

    def _add_silo_modes_to_methods(self, test_class: type) -> type:
        for (method_name, test_method) in self._find_all_test_methods(test_class):
            for (new_method_name, new_test_method) in self._create_mode_methods(test_method):
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
                        with override_settings(SENTRY_REGION="north_america"):
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
            pytest.mark.parametrize("silo_mode", [mode for mode in self.silo_modes])(
                new_test_method
            ),
        )

    def _call(self, decorated_obj: Any, stable: bool) -> Any:
        is_test_case_class = isinstance(decorated_obj, type) and issubclass(decorated_obj, TestCase)
        is_function = callable(decorated_obj)
        if not (is_test_case_class or is_function):
            raise ValueError("@SiloModeTest must decorate a function or TestCase class")

        # Only run non monolith tests when they are marked stable or we are explicitly running for that mode.
        if not stable and not self.run_unstable_tests:
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
