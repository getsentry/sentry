import contextlib
import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, Generator, Generic, Mapping, Optional, Type, TypeVar, cast

logger = logging.getLogger(__name__)

from sentry.silo import SiloMode


class InterfaceWithLifecycle(ABC):
    @abstractmethod
    def close(self) -> None:
        pass


ServiceInterface = TypeVar("ServiceInterface", bound=InterfaceWithLifecycle)


class DelegatedBySiloMode(Generic[ServiceInterface]):
    """
    Using a mapping of silo modes to backing type classes that match the same ServiceInterface,
    delegate method calls to a singleton that is managed based on the current SiloMode.get_current_mode().
    This delegator is dynamic -- it knows to swap the backing implementation even when silo mode is overwritten
    during run time, or even via the stubbing methods in this module.

    It also supports lifecycle management by invoking close() on the backing implementation anytime either this
    service is closed, or when the backing service implementation changes.
    """

    _constructors: Mapping[SiloMode, Callable[[], ServiceInterface]]
    _singleton: Dict[SiloMode, ServiceInterface]

    def __init__(self, mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]):
        self._constructors = mapping
        self._singleton = {}

    @contextlib.contextmanager
    def with_replacement(
        self, service: Optional[ServiceInterface], silo_mode: SiloMode
    ) -> Generator[None, None, None]:
        prev = self._singleton
        self.close()

        if service:
            self._singleton[silo_mode] = service
            yield
        else:
            yield
        self.close()
        self._singleton = prev

    def __getattr__(self, item: str) -> Any:
        cur_mode = SiloMode.get_current_mode()
        if impl := self._singleton.get(cur_mode, None):
            return getattr(impl, item)
        if con := self._constructors.get(cur_mode, None):
            self.close()
            return getattr(self._singleton.setdefault(cur_mode, con()), item)

        raise KeyError(f"No implementation found for {cur_mode}.")

    def close(self) -> None:
        for impl in self._singleton.values():
            impl.close()
        self._singleton = {}


def CreateStubFromBase(base: Type[ServiceInterface]) -> Type[ServiceInterface]:
    """
    Using a concrete implementation class of a service, creates a new concrete implementation class suitable for a test
    stub.  It retains parity with the given base by passing through all of its abstract method implementations to the
    given base class, but wraps it with `exempt_from_silo_limits`, allowing tests written for monolith mode to largely
    work symmetrically.  In the future, however, when monolith mode separate is deprecated, this logic should be
    replaced by true mocking utilities.

    This implementation will not work outside of test contexts.
    """
    Super = base.__bases__[0]

    def __init__(self: Any, *args: Any, **kwds: Any) -> None:
        self.backing_service = base(*args, **kwds)

    def close(self: Any) -> None:
        self.backing_service.close()

    def make_method(method_name: str) -> Any:
        def method(self: Any, *args: Any, **kwds: Any) -> Any:
            from sentry.testutils.silo import exempt_from_silo_limits

            with exempt_from_silo_limits():
                return getattr(self.backing_service, method_name)(*args, **kwds)

        return method

    methods = {
        name: make_method(name)
        for name in dir(Super)
        if getattr(getattr(Super, name), "__isabstractmethod__", False)
    }

    methods["close"] = close
    methods["__init__"] = __init__

    return cast(Type[ServiceInterface], type(f"Stub{Super.__name__}", (Super,), methods))


def silo_mode_delegation(
    mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]
) -> ServiceInterface:
    """
    Simply creates a DelegatedBySiloMode from a mapping object, but casts it as a ServiceInterface matching
    the mapping values.
    """
    return cast(ServiceInterface, DelegatedBySiloMode(mapping))


@contextlib.contextmanager
def service_stubbed(
    service: InterfaceWithLifecycle,
    stub: Optional[InterfaceWithLifecycle],
    silo_mode: Optional[SiloMode] = None,
) -> Generator[None, None, None]:
    """
    Replaces a service created with silo_mode_delegation with a replacement implementation while inside of the scope,
    closing the existing implementation on enter and closing the given implementation on exit.
    """
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(stub, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


@contextlib.contextmanager
def use_real_service(
    service: InterfaceWithLifecycle, silo_mode: SiloMode
) -> Generator[None, None, None]:
    """
    Removes any stubbed implementations, forcing the default configured implementation.
    Important for integration tests that validate the integration of production service implementations.
    """
    from django.test import override_settings

    if isinstance(service, DelegatedBySiloMode):
        with override_settings(SILO_MODE=silo_mode):
            with service.with_replacement(None, silo_mode):
                yield
    else:
        raise ValueError("Service needs to be a DelegatedBySiloMode object, but it was not!")
