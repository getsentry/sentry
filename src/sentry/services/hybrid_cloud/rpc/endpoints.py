from __future__ import annotations

import abc
import contextlib
import dataclasses
import inspect
from functools import cached_property
from typing import (
    Any,
    Callable,
    ContextManager,
    Generic,
    Mapping,
    MutableMapping,
    Protocol,
    Tuple,
    Type,
    TypeVar,
    get_type_hints,
)

from sentry.models import OrganizationMapping
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, ServiceInterface
from sentry.services.hybrid_cloud.rpc.serialization import (
    JsonSerializer,
    TypeSerializationError,
    get_serializer_from_annotation,
    get_serializer_from_args,
)
from sentry.silo import SiloMode
from sentry.silo.client import BaseSiloClient, RegionSiloClient
from sentry.types.region import RegionResolutionError, get_region_by_name

_T = TypeVar("_T")
_S = TypeVar("_S")


class RpcError(Exception):
    pass


class NoMethodError(RpcError):
    pass


class NoRouteError(RpcError):
    pass


class MissingOrgError(RpcError):
    pass


class MissingRegionError(RegionResolutionError, RpcError):
    pass


@dataclasses.dataclass
class ServiceEndpoint:
    service_name: str
    factory: Callable[[], InterfaceWithLifecycle]
    silo_mode: SiloMode

    def __post_init__(self):
        assert (
            self.service_base
        ), "Service factory functions must annotate a InterfaceWithLifecycle service base"
        self.published_methods  # Prevalidate method signatures are serializable.

    @cached_property
    def service_base(self) -> Type[InterfaceWithLifecycle] | None:
        annotations: Mapping[str, Any] = get_type_hints(self.factory)
        return_annotation: Any = annotations.get("return", None)
        if issubclass(return_annotation, InterfaceWithLifecycle) and inspect.isabstract(
            return_annotation
        ):
            return return_annotation
        return None

    @contextlib.contextmanager
    def prepare_call(
        self, method_name: str
    ) -> ContextManager[Tuple[Callable[..., Any], MethodEndpoint]]:
        service = self.factory()
        try:
            yield getattr(service, method_name), self.published_methods[method_name]
        finally:
            service.close()

    @cached_property
    def published_methods(self) -> Mapping[str, MethodEndpoint]:
        result: MutableMapping[str, MethodEndpoint] = {}
        for k in dir(self.service_base):
            method = getattr(self.service_base, k)
            if not self._is_published_method(method):
                continue

            try:
                args_serializer = get_serializer_from_args(method)
                return_annotation = get_type_hints(self.factory).get("return", None)
                return_serializer = get_serializer_from_annotation(return_annotation)
                result[method] = MethodEndpoint(args_serializer, return_serializer, k)
            except TypeSerializationError as e:
                raise TypeSerializationError(
                    f"Service {self.service_name!r} has invalid published method {k!r}: {e}"
                )

        return result

    def _is_published_method(self, v: Any):
        if not inspect.ismethod(v):
            return False
        if not getattr(v, "__isabstractmethod__"):
            return False
        return True


@dataclasses.dataclass
class MethodEndpoint:
    params_serializer: JsonSerializer
    result_serializer: JsonSerializer
    method_name: str


endpoint_registry: MutableMapping[str, ServiceEndpoint] = {}


def expose_as_region_silo_rpc(
    service_name: str, f: Callable[[], ServiceInterface]
) -> Callable[[], ServiceInterface]:
    if service_name in endpoint_registry:
        raise ValueError(f"Service {service_name} registered twice!")

    endpoint_registry[service_name] = ServiceEndpoint(
        factory=f, service_name=service_name, silo_mode=SiloMode.REGION
    )
    return f


def impl_with_region_silo_client(
    service_name: str, service_base: Type[ServiceInterface]
) -> Callable[[], ServiceInterface]:
    pass


class RpcClient(abc.ABC):
    @abc.abstractmethod
    def route(self, method_name: str, parameters: Mapping[str, Any]) -> BaseSiloClient:
        pass

    def invoke(
        self, method_name: str, parameters: Mapping[str, Any], result_dataclass: Type[_T]
    ) -> _T:
        pass


class RegionRpcClient(Generic[ServiceInterface], RpcClient):
    service_name: str
    service_base: ServiceInterface

    def __init__(self, service_name: str, service_base: ServiceInterface):
        self.service_name = service_name
        self.service_base = service_base

    def route(self, method_name: str, parameters: Mapping[str, Any]) -> BaseSiloClient:
        if not hasattr(self.service_base, method_name):
            raise NoMethodError(f"No method for rpc {self.service_name} {repr(method_name)}")

        method = getattr(self.service_base, method_name)
        org_routing: Callable[..., str | int] | None = getattr(method, "__org_routing")

        org: str | int = org_routing(**parameters)
        region_name: str | None
        if isinstance(org, str):
            region_name = OrganizationMapping.find_region_name_by_org_slug(org)
        else:
            region_name = OrganizationMapping.find_region_name_by_org_id(org)

        if region_name is None:
            raise MissingOrgError(
                f"Organization {repr(org)} does not exist in OrganizationMapping."
            )

        try:
            region = get_region_by_name(region_name)
        except RegionResolutionError as e:
            raise MissingRegionError(str(e))

        return RegionSiloClient(region)


class HasOrganizationId(Protocol):
    organization_id: int


class HasOrganizationSlug(Protocol):
    organization_slug: str


class HasRegionName(Protocol):
    region_name: str


_HasOrganizationId = TypeVar("_HasOrganizationId", bound=HasOrganizationId)
_HasOrganizationSlug = TypeVar("_HasOrganizationSlug", bound=HasOrganizationSlug)
_HasRegionName = TypeVar("_HasRegionName", bound=HasRegionName)


def routes_region_by_org_id(
    method: Callable[[_S, _HasOrganizationId], _T]
) -> Callable[[_S, _HasOrganizationId], _T]:
    def route_by_org_id(m: HasOrganizationId) -> str:
        return OrganizationMapping.find_region_name_by_org_id(m.organization_id)

    setattr(method, "__org_routing", route_by_org_id)
    return method


def routes_region_by_region_name(
    method: Callable[[_S, _HasRegionName], _T]
) -> Callable[[_S, _HasRegionName], _T]:
    def route_by_region_name(m: HasRegionName) -> str:
        return m.region_name

    setattr(method, "__org_routing", route_by_region_name)
    return method


def routes_region_by_org_slug(
    method: Callable[[_S, _HasOrganizationSlug], _T]
) -> Callable[[_S, _HasOrganizationSlug], _T]:
    def route_by_org_slug(m: HasOrganizationSlug) -> str:
        return OrganizationMapping.find_region_name_by_org_slug(m.organization_slug)

    setattr(method, "__org_routing", route_by_org_slug)
    return method
