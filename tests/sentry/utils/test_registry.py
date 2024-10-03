from collections.abc import Callable

import pytest

from sentry.testutils.cases import TestCase
from sentry.utils.registry import AlreadyRegisteredError, NoRegistrationExistsError, Registry


class RegistryTest(TestCase):
    def test(self):
        test_registry = Registry[Callable]()

        @test_registry.register("something")
        def registered_func():
            pass

        def unregistered_func():
            pass

        assert test_registry.get("something") == registered_func
        with pytest.raises(NoRegistrationExistsError):
            test_registry.get("something else")

        with pytest.raises(AlreadyRegisteredError):
            test_registry.register("something")(unregistered_func)

        test_registry.register("something else")(unregistered_func)
        assert test_registry.get("something else") == unregistered_func
