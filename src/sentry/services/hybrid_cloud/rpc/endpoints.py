from typing import Any, Callable, Generic, Mapping, MutableMapping, Type, TypeVar

from sentry.silo import SiloMode

_ServiceClass = TypeVar("_ServiceClass")
_RPC_METHOD_LABEL = "__is_hc_rpc_method"


class RpcServiceEndpoint(Generic[_ServiceClass]):
    def __init__(self, silo_mode: SiloMode, name: str, service_obj: _ServiceClass) -> None:
        self.silo_mode = silo_mode
        self.name = name
        self.service_obj = service_obj
        self.method_table = self._build_method_table(service_obj)

    @staticmethod
    def _build_method_table(service_obj: _ServiceClass) -> Mapping[str, Callable[..., Any]]:
        table = {}
        for attr_name in dir(service_obj):
            attr = getattr(service_obj, attr_name)
            if callable(attr) and getattr(attr, _RPC_METHOD_LABEL, False):
                table[attr_name] = attr
        return table


_rpc_service_endpoint_registry: MutableMapping[str, RpcServiceEndpoint[Any]] = {}


def rpc_service(silo_mode: SiloMode, name: str) -> Callable[..., Type[_ServiceClass]]:
    def decorator(service_class: Type[_ServiceClass]) -> Type[_ServiceClass]:
        service_obj = service_class()
        endpoint = RpcServiceEndpoint(silo_mode, name, service_obj)
        _rpc_service_endpoint_registry[name] = endpoint
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


def look_up_method(service_name: str, method_name: str) -> Callable[..., Any]:
    try:
        service_obj = _rpc_service_endpoint_registry[service_name]
    except KeyError:
        raise RpcResolutionError(f"Unrecognized service name: {service_name!r}")

    try:
        method_obj = service_obj.method_table[method_name]
    except KeyError:
        raise RpcResolutionError(f"Unrecognized method name: {method_name!r}")

    return method_obj
