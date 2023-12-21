from __future__ import annotations

import abc
import hashlib
import hmac
import inspect
import logging
from abc import abstractmethod
from collections.abc import Iterable
from contextlib import contextmanager
from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    Iterator,
    Mapping,
    MutableMapping,
    NoReturn,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    cast,
)

import django.urls
import pydantic
import requests
import sentry_sdk
from django.conf import settings
from typing_extensions import Self

from sentry.services.hybrid_cloud import ArgumentDict, DelegatedBySiloMode, RpcModel
from sentry.services.hybrid_cloud.rpcmetrics import RpcMetricRecord
from sentry.services.hybrid_cloud.sig import SerializableFunctionSignature
from sentry.silo import SiloMode
from sentry.types.region import Region, RegionMappingNotFound
from sentry.utils import json, metrics
from sentry.utils.env import in_test_environment

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.region import RegionResolutionStrategy

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

_IS_RPC_METHOD_ATTR = "__is_rpc_method"
_REGION_RESOLUTION_ATTR = "__region_resolution"
_REGION_RESOLUTION_OPTIONAL_RETURN_ATTR = "__region_resolution_optional_return"


class RpcException(Exception):
    def __init__(self, service_name: str, method_name: str | None, message: str) -> None:
        name = f"{service_name}.{method_name}" if method_name else service_name
        super().__init__(f"{name}: {message}")


class RpcServiceSetupException(RpcException):
    """Indicates an error in declaring the properties of RPC services."""


class RpcMethodSignature(SerializableFunctionSignature):
    """Represent the contract for an RPC method.

    This class is responsible for serializing and deserializing arguments. If the
    base service runs in the region silo, this class is also responsible for
    resolving the arguments to the correct region for a remote call.
    """

    def __init__(self, base_service_cls: Type[RpcService], base_method: Callable[..., Any]) -> None:
        self.base_service_cls = base_service_cls
        super().__init__(base_method, is_instance_method=True)
        self._region_resolution = self._extract_region_resolution()

    def _setup_exception(self, message: str) -> RpcServiceSetupException:
        return RpcServiceSetupException(
            self.base_service_cls.__name__, self.base_function.__name__, message
        )

    def get_name_segments(self) -> Sequence[str]:
        return (self.base_service_cls.__name__, self.base_function.__name__)

    def _extract_region_resolution(self) -> RegionResolutionStrategy | None:
        region_resolution = getattr(self.base_function, _REGION_RESOLUTION_ATTR, None)

        is_region_service = self.base_service_cls.local_mode == SiloMode.REGION
        if not is_region_service and region_resolution is not None:
            raise self._setup_exception(
                "@regional_rpc_method should be used only on a service with "
                "`local_mode = SiloMode.REGION`"
            )
        if is_region_service and region_resolution is None:
            raise self._setup_exception("Needs @regional_rpc_method")

        return region_resolution

    def resolve_to_region(self, arguments: ArgumentDict) -> _RegionResolutionResult:
        if self._region_resolution is None:
            raise self._setup_exception("Does not run on the region silo")

        try:
            region = self._region_resolution.resolve(arguments)
            return _RegionResolutionResult(region)
        except RegionMappingNotFound:
            if getattr(self.base_function, _REGION_RESOLUTION_OPTIONAL_RETURN_ATTR, False):
                return _RegionResolutionResult(None, is_early_halt=True)
            else:
                raise


@dataclass(frozen=True)
class _RegionResolutionResult:
    region: Region | None
    is_early_halt: bool = False

    def __post_init__(self) -> None:
        if (self.region is None) != self.is_early_halt:
            raise ValueError("region must be supplied if and only if not halting early")


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
    resolve: RegionResolutionStrategy,
    return_none_if_mapping_not_found: bool = False,
) -> Callable[[Callable[..., _T]], Callable[..., _T]]:
    """Decorate methods to be exposed as part of the RPC interface.

    In addition, resolves the region based on the resolve callback function.
    Should be applied only to methods of an RpcService subclass.

    The `return_none_if_mapping_not_found` option indicates that, if we fail to find
    a region in which to look for the queried object, the decorated method should
    return `None` indicating that the queried object does not exist. This should be
    set only on methods with an `Optional[...]` return type.
    """

    def decorator(method: Callable[..., _T]) -> Callable[..., _T]:
        setattr(method, _REGION_RESOLUTION_ATTR, resolve)
        setattr(method, _REGION_RESOLUTION_OPTIONAL_RETURN_ATTR, return_none_if_mapping_not_found)
        return rpc_method(method)

    return decorator


_global_service_registry: Dict[str, DelegatingRpcService] = {}


class RpcService(abc.ABC):
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
                raise RpcServiceSetupException(
                    cls.__name__, None, "`key` class attribute (str) is required"
                )
            if not isinstance(getattr(cls, "local_mode", None), SiloMode):
                raise RpcServiceSetupException(
                    cls.key, None, "`local_mode` class attribute (SiloMode) is required"
                )
        cls._signatures = cls._create_signatures()

    @classmethod
    def _get_all_rpc_methods(cls) -> Iterator[Callable[..., Any]]:
        for attr_name in dir(cls):
            attr = getattr(cls, attr_name, None)
            if callable(attr) and getattr(attr, _IS_RPC_METHOD_ATTR, False):
                yield attr

    @classmethod
    def _get_abstract_rpc_methods(cls) -> Iterator[Callable[..., Any]]:
        return (m for m in cls._get_all_rpc_methods() if getattr(m, "__isabstractmethod__", False))

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
                raise RpcServiceSetupException(
                    cls.key, base_method.__name__, "Error on parameter model"
                ) from e
            else:
                model_table[base_method.__name__] = signature
        return model_table

    @classmethod
    def _get_and_validate_local_implementation(cls) -> RpcService:
        def get_parameters(method: Callable[..., Any]) -> set[str]:
            """Get the expected set of parameter names.

            The `inspect.signature` also gives us type annotations (on parameters and
            the return value) but it's tricky to compare those, because of
            semantically equivalent annotations represented with unequal type tokens,
            such as `Optional[int]` versus `int | None`.
            """
            sig = inspect.signature(method)
            param_names = list(sig.parameters.keys())
            if param_names and param_names[0] == "self":
                del param_names[0]
            return set(param_names)

        impl = cls.get_local_implementation()
        for method_sig in cls._get_abstract_rpc_methods():
            method_impl = getattr(impl, method_sig.__name__)

            if getattr(method_impl, "__isabstractmethod__", False):
                raise RpcServiceSetupException(
                    cls.key,
                    method_sig.__name__,
                    f"{type(impl).__name__} must provide a concrete implementation",
                )

            sig_params = get_parameters(method_sig)
            impl_params = get_parameters(method_impl)
            if not sig_params == impl_params:
                raise RpcServiceSetupException(
                    cls.key,
                    method_sig.__name__,
                    "Does not match specified parameters "
                    f"(expected: {sig_params!r}; actual: {impl_params!r})",
                )

        return impl

    @classmethod
    def _create_remote_implementation(cls, use_test_client: bool | None = None) -> RpcService:
        """Create a service object that makes remote calls to another silo.

        The service object will implement each abstract method with an RPC method
        decorator by making a remote call to another silo. Non-abstract methods with
        an RPC method decorator are not overridden and are executed locally as normal
        (but are still available as part of the RPC interface for external clients).
        """
        if use_test_client is None:
            use_test_client = in_test_environment()

        def create_remote_method(method_name: str) -> Callable[..., Any]:
            signature = cls._signatures[method_name]

            def remote_method(service_obj: RpcService, **kwargs: Any) -> Any:
                if signature is None:
                    raise RpcServiceSetupException(
                        cls.key,
                        method_name,
                        f"Signature was not initialized for {cls.__name__}.{method_name}",
                    )

                if cls.local_mode == SiloMode.REGION:
                    result = signature.resolve_to_region(kwargs)
                    if result.is_early_halt:
                        return None
                    region = result.region
                else:
                    region = None

                serial_arguments = signature.serialize_arguments(kwargs)
                return dispatch_remote_call(
                    region, cls.key, method_name, serial_arguments, use_test_client=use_test_client
                )

            return remote_method

        overrides = {
            service_method.__name__: create_remote_method(service_method.__name__)
            for service_method in cls._get_abstract_rpc_methods()
        }
        remote_service_class = type(f"{cls.__name__}__RemoteDelegate", (cls,), overrides)
        return cast(RpcService, remote_service_class())

    @classmethod
    def create_delegation(cls, use_test_client: bool | None = None) -> Self:
        """Instantiate a base service class for the current mode."""
        constructors = {
            mode: (
                cls._get_and_validate_local_implementation
                if mode == SiloMode.MONOLITH or mode == cls.local_mode
                else lambda: cls._create_remote_implementation(use_test_client=use_test_client)
            )
            for mode in SiloMode
        }
        service = DelegatingRpcService(cls, constructors, cls._signatures)
        _global_service_registry[cls.key] = service
        # this returns a proxy which simulates the given class
        return service  # type: ignore[return-value]


class RpcResolutionException(Exception):
    """Indicate that an RPC service or method name could not be resolved."""


class RpcRemoteException(RpcException):
    """Indicate that an RPC service returned an error status code."""


class RpcResponseException(RpcException):
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

    def result_to_dict(value: Any) -> Any:
        if isinstance(value, RpcModel):
            return value.dict()

        if isinstance(value, dict):
            return {key: result_to_dict(val) for key, val in value.items()}

        if isinstance(value, Iterable) and not isinstance(value, str):
            return [result_to_dict(item) for item in value]

        return value

    return {
        "meta": {},  # reserved for future use
        "value": result_to_dict(result),
    }


_RPC_CONTENT_CHARSET = "utf-8"


def dispatch_remote_call(
    region: Region | None,
    service_name: str,
    method_name: str,
    serial_arguments: ArgumentDict,
    use_test_client: bool = False,
) -> Any:
    remote_silo_call = _RemoteSiloCall(region, service_name, method_name, serial_arguments)
    return remote_silo_call.dispatch(use_test_client)


@dataclass(frozen=True)
class _RemoteSiloCall:
    region: Region | None
    service_name: str
    method_name: str
    serial_arguments: ArgumentDict

    @property
    def address(self) -> str:
        if self.region is None:
            if not settings.SENTRY_CONTROL_ADDRESS:
                raise RpcServiceSetupException(
                    self.service_name, self.method_name, "Control silo address is not configured"
                )
            return settings.SENTRY_CONTROL_ADDRESS
        else:
            if not self.region.address:
                raise RpcServiceSetupException(
                    self.service_name,
                    self.method_name,
                    f"Address for region {self.region.name!r} is not configured",
                )
            return self.region.address

    @property
    def path(self) -> str:
        return django.urls.reverse(
            "sentry-api-0-rpc-service",
            kwargs={"service_name": self.service_name, "method_name": self.method_name},
        )

    def dispatch(self, use_test_client: bool = False) -> Any:
        serial_response = self._send_to_remote_silo(use_test_client)

        return_value = serial_response["value"]
        service, _ = _look_up_service_method(self.service_name, self.method_name)
        return (
            None
            if return_value is None
            else service.deserialize_rpc_response(self.method_name, return_value)
        )

    def _metrics_tags(self, **additional_tags: str | int) -> Mapping[str, str | int | None]:
        return dict(
            rpc_destination_region=self.region.name if self.region else None,
            rpc_service=self.service_name,
            rpc_method=self.method_name,
            **additional_tags,
        )

    def _send_to_remote_silo(self, use_test_client: bool) -> Any:
        request_body = {
            "meta": {},  # reserved for future use
            "args": self.serial_arguments,
        }
        data = json.dumps(request_body).encode(_RPC_CONTENT_CHARSET)
        signature = generate_request_signature(self.path, data)
        headers = {
            "Content-Type": f"application/json; charset={_RPC_CONTENT_CHARSET}",
            "Authorization": f"Rpcsignature {signature}",
        }

        with self._open_request_context():
            if use_test_client:
                response = self._fire_test_request(headers, data)
            else:
                response = self._fire_request(headers, data)
            metrics.incr(
                "hybrid_cloud.dispatch_rpc.response_code",
                tags=self._metrics_tags(status=response.status_code),
            )

            if response.status_code == 200:
                metrics.gauge(
                    "hybrid_cloud.dispatch_rpc.response_size",
                    len(response.content),
                    tags=self._metrics_tags(),
                )
                return response.json()
            self._raise_from_response_status_error(response)

    @contextmanager
    def _open_request_context(self):
        timer = metrics.timer("hybrid_cloud.dispatch_rpc.duration", tags=self._metrics_tags())
        span = sentry_sdk.start_span(
            op="hybrid_cloud.dispatch_rpc",
            description=f"rpc to {self.service_name}.{self.method_name}",
        )
        record = RpcMetricRecord.measure(self.service_name, self.method_name)
        with span, timer, record:
            yield

    def _remote_exception(self, message: str) -> RpcRemoteException:
        return RpcRemoteException(self.service_name, self.method_name, message)

    def _raise_from_response_status_error(self, response: requests.Response) -> NoReturn:
        if in_test_environment():
            if response.status_code == 500:
                raise self._remote_exception(
                    f"Error invoking rpc at {self.path!r}: check error logs for more details"
                )
            detail = response.json()["detail"]
            raise self._remote_exception(
                f"Error ({response.status_code} status) invoking rpc at {self.path!r}: {detail}"
            )
        # Careful not to reveal too much information in production
        if response.status_code == 403:
            raise self._remote_exception("Unauthorized service access")
        if response.status_code == 400:
            raise self._remote_exception("Invalid service request")
        raise self._remote_exception(f"Service unavailable ({response.status_code} status)")

    def _fire_test_request(self, headers: Mapping[str, str], data: bytes) -> Any:
        from django.test import Client

        from sentry.db.postgres.transactions import in_test_assert_no_transaction

        in_test_assert_no_transaction(
            f"remote service method to {self.path} called inside transaction!  Move service calls to outside of transactions."
        )

        if self.region:
            target_mode = SiloMode.REGION
        else:
            target_mode = SiloMode.CONTROL

        with SiloMode.exit_single_process_silo_context(), SiloMode.enter_single_process_silo_context(
            target_mode, self.region
        ):
            extra: Mapping[str, Any] = {
                f"HTTP_{k.replace('-', '_').upper()}": v for k, v in headers.items()
            }
            return Client().post(self.path, data, headers["Content-Type"], **extra)

    def _fire_request(self, headers: MutableMapping[str, str], data: bytes) -> requests.Response:
        # TODO: Performance considerations (persistent connections, pooling, etc.)?
        url = self.address + self.path

        # Add tracing continuation headers as the SDK doesn't monkeypatch requests.
        if traceparent := sentry_sdk.get_traceparent():
            headers["Sentry-Trace"] = traceparent
        if baggage := sentry_sdk.get_baggage():
            headers["Baggage"] = baggage
        try:
            return requests.post(url, headers=headers, data=data, timeout=settings.RPC_TIMEOUT)
        except requests.Timeout as e:
            raise self._remote_exception(f"Timeout of {settings.RPC_TIMEOUT} exceeded") from e


class RpcAuthenticationSetupException(Exception):
    """Indicates an error in declaring the settings for RPC authentication."""


def compare_signature(url: str, body: bytes, signature: str) -> bool:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without RPC_SHARED_SECRET"
        )

    if not signature.startswith("rpc0:"):
        return False

    # We aren't using the version bits currently, but might use them in the future.
    _, signature_data = signature.split(":", 2)
    signature_input = b"%s:%s" % (
        url.encode("utf8"),
        body,
    )

    for key in settings.RPC_SHARED_SECRET:
        computed = hmac.new(key.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()

        is_valid = hmac.compare_digest(computed.encode("utf-8"), signature_data.encode("utf-8"))
        if is_valid:
            return True

    return False


def generate_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    by control silo for verfication during key rotation.
    """
    if not settings.RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException("Cannot sign RPC requests without RPC_SHARED_SECRET")

    signature_input = b"%s:%s" % (
        url_path.encode("utf8"),
        body,
    )
    secret = settings.RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"
