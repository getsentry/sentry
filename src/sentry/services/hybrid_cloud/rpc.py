from __future__ import annotations

import inspect
import logging
from abc import abstractmethod
from typing import Any, Callable, Dict, Iterator, Mapping, Tuple, Type, TypeVar, cast

import pydantic

from sentry.services.hybrid_cloud import (
    ArgumentDict,
    DelegatedBySiloMode,
    InterfaceWithLifecycle,
    stubbed,
)
from sentry.silo import SiloMode
from sentry.types.region import Region

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

_IS_RPC_METHOD_ATTR = "__is_rpc_method"


class RpcServiceSetupException(Exception):
    """Indicates an error in declaring the properties of RPC services."""


class RpcServiceUnimplementedException(Exception):
    """Indicates that an RPC service is not yet able to complete a remote call.

    This is a temporary measure while the RPC services are being developed. It
    signals that a remote call in a testing or development environment should fall
    back to a monolithic implementation. When RPC services are production-ready,
    these should become hard failures.
    """


class RpcMethodSignature:
    """Represent the set of parameters expected for one RPC method.

    This class is responsible for serializing and deserializing arguments. If the
    base service runs in the region silo, this class is also responsible for
    resolving the arguments to the correct region for a remote call.
    """

    def __init__(self, base_service_cls: Type[RpcService], base_method: Callable[..., Any]) -> None:
        super().__init__()
        self._base_service_cls = base_service_cls
        self._base_method = base_method
        self._model = self._create_pydantic_model()

    @property
    def service_name(self) -> str:
        return self._base_service_cls.__name__

    @property
    def method_name(self) -> str:
        return self._base_method.__name__

    def _create_pydantic_model(self) -> Type[pydantic.BaseModel]:
        def create_field(param: inspect.Parameter) -> Tuple[Any, Any]:
            if param.annotation is param.empty:
                raise RpcServiceSetupException("Type hints are required on RPC methods")

            default_value = ... if param.default is param.empty else param.default
            return param.annotation, default_value

        name = f"{self.service_name}__{self.method_name}__ParameterModel"
        parameters = list(inspect.signature(self._base_method).parameters.values())
        parameters = parameters[1:]  # exclude `self` argument
        field_definitions = {p.name: create_field(p) for p in parameters}
        return pydantic.create_model(name, **field_definitions)  # type: ignore

    def serialize_arguments(self, raw_arguments: ArgumentDict) -> ArgumentDict:
        model_instance = self._model(**raw_arguments)
        return model_instance.dict()

    def deserialize_arguments(self, serial_arguments: ArgumentDict) -> pydantic.BaseModel:
        return self._model.parse_obj(serial_arguments)

    def resolve_to_region(self, arguments: ArgumentDict) -> Region:
        if self._base_service_cls.local_mode != SiloMode.REGION:
            raise RpcServiceSetupException(f"{self.service_name} does not run on the region silo")

        raise RpcServiceUnimplementedException("Need to resolve region")  # TODO


class DelegatingRpcService(DelegatedBySiloMode["RpcService"]):
    def __init__(
        self,
        base_service_cls: Type[RpcService],
        constructors: Mapping[SiloMode, Callable[[], RpcService]],
        signatures: Mapping[str, RpcMethodSignature],
    ) -> None:
        super().__init__(constructors)
        self._base_service_cls = base_service_cls
        self._signatures = signatures

    @property
    def local_mode(self) -> SiloMode:
        return self._base_service_cls.local_mode

    def deserialize_rpc_arguments(
        self, method_name: str, serial_arguments: ArgumentDict
    ) -> pydantic.BaseModel:
        signature = self._signatures[method_name]
        return signature.deserialize_arguments(serial_arguments)


def rpc_method(method: Callable[..., _T]) -> Callable[..., _T]:
    if not getattr(method, "__isabstractmethod__", False):
        raise RpcServiceSetupException("`@rpc_method` may only decorate abstract methods")
    setattr(method, _IS_RPC_METHOD_ATTR, True)
    return method


_global_service_registry: Dict[str, DelegatingRpcService] = {}


class RpcService(InterfaceWithLifecycle):
    name: str
    local_mode: SiloMode

    _signatures: Mapping[str, RpcMethodSignature]

    def __init_subclass__(cls) -> None:
        if cls._declares_service_interface():
            # These class attributes are required on any RpcService subclass that has
            # at least one method decorated by `@rpc_method`. (They can be left off
            # if and when we make an intermediate abstract class.)
            if not isinstance(getattr(cls, "name", None), str):
                raise RpcServiceSetupException("`name` class attribute (str) is required")
            if not isinstance(getattr(cls, "local_mode", None), SiloMode):
                raise RpcServiceSetupException(
                    "`local_mode` class attribute (SiloMode) is required"
                )
        cls._signatures = cls._create_signatures()

    @classmethod
    def _get_all_abstract_methods(cls) -> Iterator[Callable[..., Any]]:
        for attr_name in dir(cls):
            attr = getattr(cls, attr_name, None)
            if callable(attr) and getattr(attr, "__isabstractmethod__", False):
                yield attr

    @classmethod
    def _get_all_abstract_rpc_methods(cls) -> Iterator[Callable[..., Any]]:
        return (
            m for m in cls._get_all_abstract_methods() if getattr(m, _IS_RPC_METHOD_ATTR, False)
        )

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

        for _ in cls._get_all_abstract_rpc_methods():
            return True
        else:
            return False

    @classmethod
    @abstractmethod
    def get_local_implementation(cls) -> RpcService:
        """Return a service object that runs locally.

        The returned service object is (generally) the database-backed instance that
        is called when we either receive a remote call from outside, or want to call
        it within the same silo.

        A base service class generally should override this class method, making a
        forward reference to its own database-backed subclass.
        """

        raise NotImplementedError

    @classmethod
    def _create_signatures(cls) -> Mapping[str, RpcMethodSignature]:
        model_table = {}
        for base_method in cls._get_all_abstract_rpc_methods():
            try:
                signature = RpcMethodSignature(cls, base_method)
            except Exception as e:
                # To temporarily unblock development, swallow these errors and leave
                # empty spots in the parameter model table. This would cause an error
                # down the road if the method is called.
                # TODO: Make this a hard failure when all parameter models are stable
                logger.error(
                    f"Error on parameter model for {cls.__name__}.{base_method.__name__}: {e}"
                )
            else:
                model_table[base_method.__name__] = signature
        return model_table

    @classmethod
    def _create_remote_delegation(cls) -> RpcService:
        """Create a service object that makes remote calls to another silo."""

        def create_remote_method(method_name: str) -> Callable[..., Any]:
            signature = cls._signatures.get(method_name)
            fallback = stubbed(cls.get_local_implementation, cls.local_mode)

            def remote_method(service_obj: RpcService, **kwargs: Any) -> Any:
                if signature is None:
                    raise RpcServiceUnimplementedException(
                        f"Signature was not initialized for {cls.__name__}.{method_name}"
                    )

                if cls.local_mode == SiloMode.REGION:
                    region = signature.resolve_to_region(kwargs)
                else:
                    region = None

                try:
                    serial_arguments = signature.serialize_arguments(kwargs)
                except Exception as e:
                    raise RpcServiceUnimplementedException(
                        f"Could not serialize arguments for {cls.__name__}.{method_name}"
                    ) from e

                return dispatch_remote_call(region, cls.name, method_name, serial_arguments)

            def remote_method_with_fallback(service_obj: RpcService, **kwargs: Any) -> Any:
                # See RpcServiceUnimplementedException documentation
                # TODO: Remove this when RPC services are production-ready
                try:
                    return remote_method(service_obj, **kwargs)
                except RpcServiceUnimplementedException as e:
                    logger.error(f"Could not remotely call {cls.__name__}.{method_name}: {e}")

                    service = fallback()
                    method = getattr(service, method_name)
                    return method(**kwargs)

            return remote_method_with_fallback

        overrides = {
            service_method.__name__: create_remote_method(service_method.__name__)
            for service_method in cls._get_all_abstract_rpc_methods()
        }
        remote_service_class = type(f"{cls.__name__}__RemoteDelegate", (cls,), overrides)
        return cast(RpcService, remote_service_class())

    @classmethod
    def resolve_to_delegation(cls) -> DelegatingRpcService:
        constructors = {
            mode: (
                cls.get_local_implementation
                if mode == SiloMode.MONOLITH or mode == cls.local_mode
                else cls._create_remote_delegation
            )
            for mode in SiloMode
        }
        service = DelegatingRpcService(cls, constructors, cls._signatures)
        _global_service_registry[cls.name] = service
        return service

    def close(self) -> None:
        pass


class RpcResolutionException(Exception):
    """Indicate that an RPC service or method name could not be resolved."""


def _look_up_service_method(
    service_name: str, method_name: str
) -> Tuple[DelegatingRpcService, Callable[..., Any]]:
    try:
        service = _global_service_registry[service_name]
    except KeyError:
        raise RpcResolutionException(f"Not a service name: {service_name!r}")

    try:
        method = getattr(service, method_name)
    except AttributeError:
        raise RpcResolutionException(f"Not a method name on {service_name!r}: {method_name!r}")

    return service, method


def dispatch_to_local_service(
    service_name: str, method_name: str, serial_arguments: ArgumentDict
) -> Any:
    service, method = _look_up_service_method(service_name, method_name)
    raw_arguments = service.deserialize_rpc_arguments(method_name, serial_arguments)
    return method(**raw_arguments.__dict__)


def dispatch_remote_call(
    region: Region | None, service_name: str, method_name: str, serial_arguments: ArgumentDict
) -> Any:
    service, method = _look_up_service_method(service_name, method_name)
    raise RpcServiceUnimplementedException("Need to dispatch remotely")  # TODO
