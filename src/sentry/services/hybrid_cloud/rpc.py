from __future__ import annotations

import inspect
import logging
from abc import abstractmethod
from typing import TYPE_CHECKING, Any, Callable, Dict, Iterator, Mapping, Tuple, Type, TypeVar, cast

import pydantic

from sentry.services.hybrid_cloud import ArgumentDict, DelegatedBySiloMode, InterfaceWithLifecycle
from sentry.silo import SiloMode
from sentry.types.region import Region

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.region import RegionResolution

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

_IS_RPC_METHOD_ATTR = "__is_rpc_method"
_REGION_RESOLUTION_ATTR = "__region_resolution"


class RpcServiceSetupException(Exception):
    """Indicates an error in declaring the properties of RPC services."""


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
        self._validate_region_resolution()

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

    def _validate_region_resolution(self) -> None:
        is_region_service = self._base_service_cls.local_mode == SiloMode.REGION
        has_region_resolution = hasattr(self._base_method, _REGION_RESOLUTION_ATTR)

        if not is_region_service and has_region_resolution:
            raise RpcServiceSetupException(
                "@regional_rpc_method should be used only on a service with "
                "`local_mode = SiloMode.REGION`"
                f" ({self.service_name} is {self._base_service_cls.local_mode})"
            )

        if is_region_service and not has_region_resolution:
            # These methods still work perfectly fine if the server is running in
            # monolith mode. All such methods will need region resolutions before
            # RPCs are production-ready. At that point, convert this warning to an
            # RpcServiceSetupException.
            logger.warning(
                f"Method {self.service_name}.{self.method_name} needs @regional_rpc_method"
            )

    def serialize_arguments(self, raw_arguments: ArgumentDict) -> ArgumentDict:
        model_instance = self._model(**raw_arguments)
        return model_instance.dict()

    def deserialize_arguments(self, serial_arguments: ArgumentDict) -> pydantic.BaseModel:
        return self._model.parse_obj(serial_arguments)

    def resolve_to_region(self, arguments: ArgumentDict) -> Region:
        if self._base_service_cls.local_mode != SiloMode.REGION:
            raise RpcServiceSetupException(f"{self.service_name} does not run on the region silo")

        region_resolution: RegionResolution | None = getattr(
            self._base_method, _REGION_RESOLUTION_ATTR, None
        )
        if region_resolution is None:
            raise RpcServiceSetupException(
                f"No region resolution designated for {self.service_name}.{self.method_name}"
            )

        return region_resolution.resolve(arguments)


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


def regional_rpc_method(
    resolve: RegionResolution,
) -> Callable[[Callable[..., _T]], Callable[..., _T]]:
    def decorator(method: Callable[..., _T]) -> Callable[..., _T]:
        setattr(method, _REGION_RESOLUTION_ATTR, resolve)
        return rpc_method(method)

    return decorator


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

        try:
            next(cls._get_all_abstract_rpc_methods())
        except StopIteration:
            return False
        else:
            return True

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

        def create_remote_method(base_method: Callable[..., Any]) -> Callable[..., Any]:
            signature = cls._signatures[base_method.__name__]

            def remote_method(service_obj: RpcService, **kwargs: Any) -> Any:
                if cls.local_mode == SiloMode.REGION:
                    region = signature.resolve_to_region(kwargs)
                else:
                    region = None

                serial_arguments = signature.serialize_arguments(kwargs)
                return dispatch_remote_call(
                    region, cls.name, base_method.__name__, serial_arguments
                )

            return remote_method

        overrides = {
            service_method.__name__: create_remote_method(service_method)
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
    raise NotImplementedError()  # TODO
