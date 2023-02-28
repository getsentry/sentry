from abc import abstractmethod
from functools import cached_property
from typing import Any, Callable, Dict, Iterator, Mapping, TypeVar, cast

from sentry.services.hybrid_cloud import InterfaceWithLifecycle
from sentry.silo import SiloMode

_T = TypeVar("_T")
_IS_RPC_METHOD_ATTR = "__is_rpc_method"

_global_service_registry: Dict[str, "RpcService"] = {}


def rpc_method(method: Callable[..., _T]) -> Callable[..., _T]:
    method = abstractmethod(method)
    setattr(method, _IS_RPC_METHOD_ATTR, True)
    return method


class RpcService(InterfaceWithLifecycle):
    name: str
    local_mode: SiloMode

    def __init_subclass__(cls) -> None:
        if cls._declares_service_interface():
            # These class attributes are required on any RpcService subclass that has
            # at least one method decorated by `@rpc_method`. (They can be left off
            # if and when we make an intermediate abstract class.)
            if not isinstance(getattr(cls, "name", None), str):
                raise TypeError("`name` class attribute (str) is required")
            if not isinstance(getattr(cls, "local_mode", None), SiloMode):
                raise TypeError("`local_mode` class attribute (SiloMode) is required")

    @classmethod
    def _get_all_abstract_rpc_methods(cls) -> Iterator[Callable[..., Any]]:
        for attr_name in dir(cls):
            attr = getattr(cls, attr_name, None)
            if callable(attr) and getattr(attr, _IS_RPC_METHOD_ATTR, False):
                yield attr

    @classmethod
    def _declares_service_interface(cls) -> bool:
        """Check whether a subclass declares the service interface.

        By "service interface", we mean the set of RPC methods that are offered.
        Those methods are decorated by `@rpc_method`, so we return true for any
        service class that declares (but does not implement) at least one such method.

        This method would return false, for example, for the local, database-backed
        implementation that inherits from the base service. It also would return
        false on an intermediate, abstract subclass that is meant to be extended to
        declare other base services.
        """

        try:
            next(cls._get_all_abstract_rpc_methods())
        except StopIteration:
            return False
        else:
            return True

    @classmethod
    @abstractmethod
    def get_local_implementation(cls) -> "RpcService":
        """Return a service object that runs locally.

        The returned service object is (generally) the database-backed instance that
        is called when we either receive a remote call from outside, or want to call
        it within the same silo.

        A base service class generally should override this class method, making a
        forward reference to its own database-backed subclass.
        """

        raise NotImplementedError

    @classmethod
    def _create_local_delegation(cls) -> "RpcService":
        """Create a lazy wrapper around the local implementation.

        The indirection is necessary so that a base service's
        `get_local_implementation` body can safely make a forward reference that
        `resolve_to_delegation` won't call yet.
        """
        impl_attrname = "__cached_local_implementation"

        @cached_property  # type: ignore
        def cached_local_implementation(service_obj: "RpcService") -> "RpcService":
            return service_obj.get_local_implementation()

        def create_delegating_method(base_method: Callable[..., Any]) -> Callable[..., Any]:
            method_name = base_method.__name__

            def delegating_method(service_obj: "RpcService", **kwargs: Any) -> Any:
                impl = getattr(service_obj, impl_attrname)
                method = getattr(impl, method_name)
                return method(**kwargs)

            return delegating_method

        overrides = {
            service_method.__name__: create_delegating_method(service_method)
            for service_method in cls._get_all_abstract_rpc_methods()
        }
        overrides[impl_attrname] = cached_local_implementation
        remote_service_class = type(f"{cls.__name__}__LocalDelegate", (cls,), overrides)
        return cast(RpcService, remote_service_class())

    @classmethod
    def _create_remote_delegation(cls) -> "RpcService":
        """Create a service object that makes remote calls to another silo."""

        def create_remote_method(base_method: Callable[..., Any]) -> Callable[..., Any]:
            method_name = base_method.__name__

            def remote_method(**kwargs: Any) -> Any:
                # TODO: Handle kwarg serialization
                return dispatch_remote_call(cls.name, method_name, kwargs)

            return remote_method

        overrides = {
            service_method.__name__: create_remote_method(service_method)
            for service_method in cls._get_all_abstract_rpc_methods()
        }
        remote_service_class = type(f"{cls.__name__}__RemoteDelegate", (cls,), overrides)
        return cast(RpcService, remote_service_class())

    @classmethod
    def resolve_to_delegation(cls) -> "RpcService":
        current_mode = SiloMode.get_current_mode()
        if current_mode in (SiloMode.MONOLITH, cls.local_mode):
            impl = cls._create_local_delegation()
            _global_service_registry[cls.name] = impl
            return impl
        else:
            return cls._create_remote_delegation()

    def close(self) -> None:
        pass


class RpcResolutionException(Exception):
    """Indicate that an RPC service or method name could not be resolved."""


def dispatch_to_local_service(
    service_name: str, method_name: str, arguments: Mapping[str, Any]
) -> Any:
    try:
        service = _global_service_registry[service_name]
    except KeyError:
        raise RpcResolutionException(f"Not a service name: {service_name!r}")

    try:
        method = getattr(service, method_name)
    except AttributeError:
        raise RpcResolutionException(f"Not a method name on {service_name!r}: {method_name!r}")

    return method(**arguments)


def dispatch_remote_call(service_name: str, method_name: str, arguments: Mapping[str, Any]) -> Any:
    pass  # TODO
