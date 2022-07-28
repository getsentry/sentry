from __future__ import annotations

import functools
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, FrozenSet, Generator, Iterable, Tuple
from unittest import TestCase

from django.test import override_settings

from sentry.servermode import ServerComponentMode

TestMethod = Callable[..., None]
TestMethodPredicate = Callable[[TestMethod], bool]


class ServerModeTest:
    """Decorate a test class to run its test cases in server component modes.

    The decorated class will run all its test methods in monolith mode, without
    modification. It will also generate a new copy of each method for the given
    server component mode (or one for each mode), which runs in that mode.

    By default, it creates a mode-specific of every test method. Use the init
    params to apply it to only some test methods.

    The generated test methods have new names, with a suffix separated by a
    double underscore. For example,

    ```
    @ServerModeTest(ServerComponentMode.CUSTOMER)
    class HotDogTest(TestCase):
        def test_bun(self): pass
        def test_sausage(self): pass
    ```

    would yield test methods named
      - test_bun  (runs in monolith mode)
      - test_bun__in_customer_silo
      - test_sausage
      - test_sausage__in_customer_silo
    """

    def __init__(
        self,
        *modes: ServerComponentMode,
        include_names: Iterable[str] | None = None,
        exclude_names: Iterable[str] | None = None,
        include_if: TestMethodPredicate | None = None,
    ) -> None:
        """
        :param modes: the modes in which to run the test methods (in addition to
            monolith)
        :param include_names: if present, modify only the named test methods and
            ignore the rest
        :param exclude_names: if present, modify all test methods except the
            named ones
        :param include_if: if present, use this predicate to decide which test
            methods to modify if they aren't named in include_names or
            exclude_names
        """

        self.modes = tuple(modes)
        self.inclusion_condition = self.InclusionCondition(
            include_names=frozenset(include_names or ()),
            exclude_names=frozenset(exclude_names or ()),
            include_if=include_if or (lambda _: include_names is None),
        )

    @dataclass
    class InclusionCondition:
        """Designate which methods on a test class to run in other modes."""

        include_names: FrozenSet[str]
        exclude_names: FrozenSet[str]
        include_if: TestMethodPredicate

        def __call__(self, test_case_method: TestMethod) -> bool:
            if test_case_method.__name__ in self.include_names:
                return True
            if test_case_method.__name__ in self.exclude_names:
                return False
            return self.include_if(test_case_method)

    @staticmethod
    def _find_all_test_methods(test_class: type) -> Iterable[Tuple[str, TestMethod]]:
        for attr_name in dir(test_class):
            if attr_name.startswith("test_"):
                attr = getattr(test_class, attr_name)
                if callable(attr):
                    yield attr_name, attr

    def _create_mode_test_methods(
        self, test_method: TestMethod
    ) -> Iterable[Tuple[str, TestMethod]]:
        for mode in self.modes:

            def replacement_test_method(*args: Any, **kwargs: Any) -> None:
                with override_settings(SERVER_COMPONENT_MODE=mode):
                    test_method(*args, **kwargs)

            functools.update_wrapper(replacement_test_method, test_method)
            modified_name = f"{test_method.__name__}__in_{str(mode).lower()}_silo"
            replacement_test_method.__name__ = modified_name
            yield modified_name, replacement_test_method

    def __call__(self, test_class: type) -> type:
        if not (isinstance(test_class, type) and issubclass(test_class, TestCase)):
            raise ValueError("@ServerModeTest must decorate a TestCase class")
        for (method_name, test_method) in self._find_all_test_methods(test_class):
            if self.inclusion_condition(test_method):
                for (new_name, new_method) in self._create_mode_test_methods(test_method):
                    setattr(test_class, new_name, new_method)
        return test_class


control_silo_test = ServerModeTest(ServerComponentMode.CONTROL)
customer_silo_test = ServerModeTest(ServerComponentMode.CUSTOMER)


@contextmanager
def mode_exempt_setup() -> Generator[None, None, None]:
    """Enclose test code to exempt from the server mode.

    This context manager should be used to enclose code within a test method
    that sets up a test case by writing data to a silo that wouldn't be allowed
    in one of the tested server modes. Such setup code should ideally be moved
    to the test class's `setUp` method where possible, but this is available as
    a kludge when that's too inconvenient.

    For example:

    ```
    @ServerModeTest(ServerComponentMode.CUSTOMER)
    class MyTest(TestCase):
        def test_something(self):
            with mode_exempt_setup():
                org = self.create_organization()  # would be wrong if under test
            do_something(org)  # the actual code under test
    ```
    """
    with override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.MONOLITH):
        yield
