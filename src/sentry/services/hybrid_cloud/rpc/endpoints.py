import inspect
from typing import Any, Callable, Generic, Mapping, MutableMapping, Type, TypeVar

from sentry.silo import SiloMode

_ServiceClass = TypeVar("_ServiceClass")
_RPC_METHOD_LABEL = "__is_hc_rpc_method"


class RpcServiceParameter:
    def __init__(self, parameter: inspect.Parameter) -> None:
        self.name = parameter.name
        self.annotation = self._check_annotation(parameter.annotation)

    def _check_annotation(self, annotation: Any) -> Type[Any]:
        if isinstance(annotation, type):
            return annotation

        if isinstance(annotation, str):
            # Type hints on RPC service methods must have visibility to actual type
            # objects. If you see this error, ensure that:
            #   1. The method's type hints are not declared as strings.
            #   2. The types are not imported in an `if TYPE_CHECKING` block.
            #   3. There is no `from __future__ import annotations` on the module where
            #      the service is defined.
            # Fulfilling the above conditions may cause a circular import. The
            # solution usually is to find where the RPC service is being imported and
            # make it narrower (that is: move the *other* import statement to an `if
            # TYPE_CHECKING` block, or import the service locally in the function
            # where it is used).
            raise TypeError(f"String annotation on {self.name!r}")

        raise TypeError(f"Unexpected annotation type on {self.name!r}: {type(annotation)}")


class RpcServiceMethod:
    def __init__(self, method: Callable[..., Any]) -> None:
        self.parameters = tuple(
            RpcServiceParameter(parameter)
            for parameter in inspect.signature(method).parameters.values()
        )
        assert self.parameters


class RpcServiceEndpoint(Generic[_ServiceClass]):
    def __init__(self, silo_mode: SiloMode, name: str, service_obj: _ServiceClass) -> None:
        self.silo_mode = silo_mode
        self.name = name
        self.service_obj = service_obj
        self.method_table = self._build_method_table(service_obj)

    @staticmethod
    def _build_method_table(service_obj: _ServiceClass) -> Mapping[str, RpcServiceMethod]:
        table = {}
        for attr_name in dir(service_obj):
            attr = getattr(service_obj, attr_name)
            if callable(attr) and getattr(attr, _RPC_METHOD_LABEL, False):
                method_obj = RpcServiceMethod(attr)
                table[attr_name] = method_obj
        return table


_rpc_service_registry: MutableMapping[str, RpcServiceEndpoint[Any]] = {}


def rpc_service(silo_mode: SiloMode, name: str) -> Callable[..., Type[_ServiceClass]]:
    def decorator(service_class: Type[_ServiceClass]) -> Type[_ServiceClass]:
        try:
            service_obj = service_class()
        except TypeError:
            raise TypeError(
                "Classes decorated with @rpc_service must be constructible with no arguments"
            )

        endpoint = RpcServiceEndpoint(silo_mode, name, service_obj)
        _rpc_service_registry[name] = endpoint
        return service_class

    return decorator


def rpc_method(service_method: Callable[..., Any]) -> Callable[..., Any]:
    if not callable(service_method):
        raise ValueError("@rpc_method must decorate a method")
    if getattr(service_method, "__isabstractmethod__", False):
        raise ValueError("@rpc_method may not decorate an abstract method")
    if service_method.__name__.startswith("_"):
        raise ValueError("@rpc_method may not decorate a private method")

    setattr(service_method, _RPC_METHOD_LABEL, True)
    return service_method


class RpcResolutionError(Exception):
    pass


def look_up_method(service_name: str, method_name: str) -> RpcServiceMethod:
    try:
        service_obj = _rpc_service_registry[service_name]
    except KeyError:
        raise RpcResolutionError(f"Unrecognized service name: {service_name!r}")

    try:
        method_obj = service_obj.method_table[method_name]
    except KeyError:
        raise RpcResolutionError(f"Unrecognized method name: {method_name!r}")

    return method_obj


def dispatch(service_name: str, method_name: str, serial_arguments: Mapping[str, Any]) -> Any:
    pass
