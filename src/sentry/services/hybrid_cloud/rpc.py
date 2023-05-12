from __future__ import annotations

import inspect
import logging
import urllib.response
from abc import abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Dict, Iterator, Mapping, Tuple, Type, TypeVar, cast
from urllib.request import Request, urlopen

import django.urls
import pydantic
from django.conf import settings

from sentry.services.hybrid_cloud import (
    ArgumentDict,
    DelegatedBySiloMode,
    InterfaceWithLifecycle,
    RpcModel,
    stubbed,
)
from sentry.silo import SiloMode
from sentry.types.region import Region
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.region import RegionResolution

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

_IS_RPC_METHOD_ATTR = "__is_rpc_method"
_REGION_RESOLUTION_ATTR = "__region_resolution"


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
        self._parameter_model = self._create_parameter_model()
        self._return_model = self._create_return_model()
        self._region_resolution = self._extract_region_resolution()

    @property
    def service_name(self) -> str:
        return self._base_service_cls.__name__

    @property
    def method_name(self) -> str:
        return self._base_method.__name__

    @staticmethod
    def _validate_type_token(token: Any) -> None:
        """Check whether a type token is usable.

        Strings as type annotations, which Mypy can use if their types are imported
        in an `if TYPE_CHECKING` block, can't be used for (de)serialization. Raise an
        exception if the given token is one of these.

        We can check only on a best-effort basis. String tokens may still be nested
        in type parameters (e.g., `Optional["RpcThing"]`), which this won't catch.
        Such a state would cause an exception when we attempt to use the signature
        object to (de)serialize something.
        """
        if isinstance(token, str):
            raise RpcServiceSetupException(
                "Type annotations on RPC methods must be actual type tokens, not strings"
            )

    def _create_parameter_model(self) -> Type[pydantic.BaseModel]:
        """Dynamically create a Pydantic model class representing the parameters."""

        def create_field(param: inspect.Parameter) -> Tuple[Any, Any]:
            if param.annotation is param.empty:
                raise RpcServiceSetupException("Type annotations are required on RPC methods")
            self._validate_type_token(param.annotation)

            default_value = ... if param.default is param.empty else param.default
            return param.annotation, default_value

        name = f"{self.service_name}__{self.method_name}__ParameterModel"
        parameters = list(inspect.signature(self._base_method).parameters.values())
        parameters = parameters[1:]  # exclude `self` argument
        field_definitions = {p.name: create_field(p) for p in parameters}
        return pydantic.create_model(name, **field_definitions)  # type: ignore

    _RETURN_MODEL_ATTR = "value"

    def _create_return_model(self) -> Type[pydantic.BaseModel] | None:
        """Dynamically create a Pydantic model class representing the return value.

        The created model has a single attribute containing the return value. This
        extra abstraction is necessary in order to have Pydantic handle generic
        return annotations such as `Optional[RpcOrganization]` or `List[RpcUser]`,
        where we can't directly access an RpcModel class on which to call `parse_obj`.
        """
        name = f"{self.service_name}__{self.method_name}__ReturnModel"
        return_type = inspect.signature(self._base_method).return_annotation
        if return_type is None:
            return None
        self._validate_type_token(return_type)

        field_definitions = {self._RETURN_MODEL_ATTR: (return_type, ...)}
        return pydantic.create_model(name, **field_definitions)  # type: ignore

    def _extract_region_resolution(self) -> RegionResolution | None:
        region_resolution = getattr(self._base_method, _REGION_RESOLUTION_ATTR, None)

        is_region_service = self._base_service_cls.local_mode == SiloMode.REGION
        if not is_region_service and region_resolution is not None:
            raise RpcServiceSetupException(
                "@regional_rpc_method should be used only on a service with "
                "`local_mode = SiloMode.REGION`"
                f" ({self.service_name} is {self._base_service_cls.local_mode})"
            )
        if is_region_service and region_resolution is None:
            # Use RpcServiceUnimplementedException as a placeholder if needed
            raise RpcServiceSetupException(
                f"Method {self.service_name}.{self.method_name} needs @regional_rpc_method"
            )

        return region_resolution

    def serialize_arguments(self, raw_arguments: ArgumentDict) -> ArgumentDict:
        model_instance = self._parameter_model(**raw_arguments)
        return model_instance.dict()

    def deserialize_arguments(self, serial_arguments: ArgumentDict) -> pydantic.BaseModel:
        try:
            return self._parameter_model.parse_obj(serial_arguments)
        except Exception as e:
            # TODO: Parse Pydantic's exception object(s) and produce more useful
            #  error messages that can be put into the body of the HTTP 400 response
            raise RpcArgumentException from e

    def deserialize_return_value(self, value: Any) -> Any:
        if self._return_model is None:
            if value is not None:
                raise RpcResponseException(f"Expected None but got {type(value)}")
            return None

        parsed = self._return_model.parse_obj({self._RETURN_MODEL_ATTR: value})
        return getattr(parsed, self._RETURN_MODEL_ATTR)

    def resolve_to_region(self, arguments: ArgumentDict) -> Region:
        if self._region_resolution is None:
            raise RpcServiceSetupException(f"{self.service_name} does not run on the region silo")

        try:
            return self._region_resolution.resolve(arguments)
        except Exception as e:
            raise RpcServiceUnimplementedException("Error while resolving region") from e


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

    def deserialize_rpc_response(self, method_name: str, serial_response: Any) -> Any:
        signature = self._signatures[method_name]
        return signature.deserialize_return_value(serial_response)


def rpc_method(method: Callable[..., _T]) -> Callable[..., _T]:
    """Decorate methods to be exposed as part of the RPC interface.

    Should be applied only to methods of an RpcService subclass.
    """

    setattr(method, _IS_RPC_METHOD_ATTR, True)
    return method


def regional_rpc_method(
    resolve: RegionResolution,
) -> Callable[[Callable[..., _T]], Callable[..., _T]]:
    """Decorate methods to be exposed as part of the RPC interface.

    In addition, resolves the region based on the resolve callback function.

    Should be applied only to methods of an RpcService subclass.
    """

    def decorator(method: Callable[..., _T]) -> Callable[..., _T]:
        setattr(method, _REGION_RESOLUTION_ATTR, resolve)
        return rpc_method(method)

    return decorator


_global_service_registry: Dict[str, DelegatingRpcService] = {}


class RpcService(InterfaceWithLifecycle):
    """A set of methods to be exposed as part of the RPC interface.

    Extend this class to declare a "base service" where the method interfaces are
    declared and decorated by `@rpc_service`. Then extend that base service class
    with the local (database-backed) implementation.

    The base service should provide two class-level constants: `key` (the slug that
    maps to the service in a URL) and `local_mode` (the silo mode in which to use the
    local implementation).
    """

    key: str
    local_mode: SiloMode

    _signatures: Mapping[str, RpcMethodSignature]

    def __init_subclass__(cls) -> None:
        if cls._has_rpc_methods():
            # These class attributes are required on any RpcService subclass that has
            # at least one method decorated by `@rpc_method`. (They can be left off
            # if and when we make an intermediate abstract class.)
            if not isinstance(getattr(cls, "key", None), str):
                raise RpcServiceSetupException("`key` class attribute (str) is required")
            if not isinstance(getattr(cls, "local_mode", None), SiloMode):
                raise RpcServiceSetupException(
                    "`local_mode` class attribute (SiloMode) is required"
                )
        cls._signatures = cls._create_signatures()

    @classmethod
    def _get_all_rpc_methods(cls) -> Iterator[Callable[..., Any]]:
        for attr_name in dir(cls):
            attr = getattr(cls, attr_name, None)
            if callable(attr) and getattr(attr, _IS_RPC_METHOD_ATTR, False):
                yield attr

    @classmethod
    def _has_rpc_methods(cls) -> bool:
        for _ in cls._get_all_rpc_methods():
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
        for base_method in cls._get_all_rpc_methods():
            try:
                signature = RpcMethodSignature(cls, base_method)
            except Exception as e:
                # While remote services are under development, swallow these errors
                # and leave empty spots in the parameter model table. This will cause
                # an RpcServiceUnimplementedException when the method is called.
                # TODO: Make this a hard failure when all parameter models are stable
                if SiloMode.get_current_mode() != SiloMode.MONOLITH:
                    logger.warning(
                        f"Error on parameter model for {cls.__name__}.{base_method.__name__}: {e}"
                    )
            else:
                model_table[base_method.__name__] = signature
        return model_table

    @classmethod
    def _create_remote_implementation(cls) -> RpcService:
        """Create a service object that makes remote calls to another silo.

        The service object will implement each abstract method with an RPC method
        decorator by making a remote call to another silo. Non-abstract methods with
        an RPC method decorator are not overridden and are executed locally as normal
        (but are still available as part of the RPC interface for external clients).
        """

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

                return dispatch_remote_call(region, cls.key, method_name, serial_arguments)

            def remote_method_with_fallback(service_obj: RpcService, **kwargs: Any) -> Any:
                # See RpcServiceUnimplementedException documentation
                # TODO: Remove this when RPC services are production-ready
                try:
                    return remote_method(service_obj, **kwargs)
                except RpcServiceUnimplementedException as e:
                    logger.info(f"Could not remotely call {cls.__name__}.{method_name}: {e}")
                    # Drop out of the except block, so that we don't get a spurious
                    #     "During handling of the above exception, another exception occurred"
                    # message in case the fallback method raises an unrelated exception.

                service = fallback()
                method = getattr(service, method_name)
                return method(**kwargs)

            return remote_method_with_fallback

        overrides = {
            service_method.__name__: create_remote_method(service_method.__name__)
            for service_method in cls._get_all_rpc_methods()
            if getattr(service_method, "__isabstractmethod__", False)
        }
        remote_service_class = type(f"{cls.__name__}__RemoteDelegate", (cls,), overrides)
        return cast(RpcService, remote_service_class())

    @classmethod
    def create_delegation(cls) -> DelegatingRpcService:
        """Instantiate a base service class for the current mode."""
        constructors = {
            mode: (
                cls.get_local_implementation
                if mode == SiloMode.MONOLITH or mode == cls.local_mode
                else cls._create_remote_implementation
            )
            for mode in SiloMode
        }
        service = DelegatingRpcService(cls, constructors, cls._signatures)
        _global_service_registry[cls.key] = service
        return service

    def close(self) -> None:
        pass


class RpcResolutionException(Exception):
    """Indicate that an RPC service or method name could not be resolved."""


class RpcArgumentException(Exception):
    """Indicate that the serial arguments to an RPC service were invalid."""


class RpcResponseException(Exception):
    """Indicate that the response from a remote RPC service violated expectations."""


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
    result = method(**raw_arguments.__dict__)
    return result.dict() if isinstance(result, RpcModel) else result


_RPC_CONTENT_CHARSET = "utf-8"


def dispatch_remote_call(
    region: Region | None, service_name: str, method_name: str, serial_arguments: ArgumentDict
) -> Any:
    service, _ = _look_up_service_method(service_name, method_name)

    creds = RpcSenderCredentials.read_from_settings()
    if not creds.is_allowed:
        raise RpcSendException("RPC calls are not globally enabled")

    if region is None:
        address = creds.control_silo_address
        api_token = creds.control_silo_api_token
        if not (address and api_token):
            raise RpcSendException("Not configured to remotely access control silo")
    else:
        address = region.address
        api_token = region.api_token
        if not (address and api_token):
            raise RpcSendException(f"Not configured to remotely access region: {region.name}")

    path = django.urls.reverse(
        "sentry-api-0-rpc-service",
        kwargs={"service_name": service_name, "method_name": method_name},
    )
    url = address + path

    request_body = {
        "meta": {},  # reserved for future use
        "args": serial_arguments,
    }

    with _fire_request(url, request_body, api_token) as response:
        charset = response.headers.get_content_charset() or _RPC_CONTENT_CHARSET
        response_body = response.read().decode(charset)
    serial_response = json.loads(response_body)
    return service.deserialize_rpc_response(method_name, serial_response)


def _fire_request(url: str, body: Any, api_token: str) -> urllib.response.addinfourl:
    # TODO: Performance considerations (persistent connections, pooling, etc.)?

    data = json.dumps(body).encode(_RPC_CONTENT_CHARSET)

    request = Request(url)
    request.add_header("Content-Type", f"application/json; charset={_RPC_CONTENT_CHARSET}")
    request.add_header("Content-Length", str(len(data)))
    request.add_header("Authorization", f"Bearer {api_token}")
    return urlopen(request, data)  # type: ignore


@dataclass(frozen=True)
class RpcSenderCredentials:
    """Credentials for sending remote procedure calls.

    This implementation is for dev environments only, and presumes that the
    credentials can be picked up from Django settings. A production implementation
    will likely look different.
    """

    is_allowed: bool = False
    control_silo_api_token: str | None = None
    control_silo_address: str | None = None

    @classmethod
    def read_from_settings(cls) -> RpcSenderCredentials:
        setting_values = settings.DEV_HYBRID_CLOUD_RPC_SENDER
        if isinstance(setting_values, str):
            setting_values = json.loads(setting_values)
        return cls(**setting_values) if setting_values else cls()


class RpcSendException(RpcServiceUnimplementedException):
    """Indicates the system is not configured to send RPCs."""
