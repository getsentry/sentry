# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from dataclasses import dataclass

from sentry.hybridcloud.rpc.resolvers import ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method, rpc_method
from sentry.silo.base import SiloMode


@dataclass(frozen=True)
class ByRequestingRegionName(ByRegionName):
    parameter_name: str = "requesting_region_name"


@dataclass(frozen=True)
class ByReplyingRegionName(ByRegionName):
    parameter_name: str = "replying_region_name"


# See the comment on /src/sentry/relocation/tasks/process.py::uploading_start for a detailed description of
# how this service fits into the entire SAAS->SAAS relocation workflow.
class RegionRelocationExportService(RpcService):
    """
    Service that implements asynchronous relocation export request and reply methods. The request
    method is sent by the requesting region to the exporting region, with
    `ControlRelocationExportService` acting as a middleman proxy.
    """

    key = "region_relocation_export"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.relocation.services.relocation_export.impl import (
            DBBackedRelocationExportService,
        )

        return DBBackedRelocationExportService()

    @regional_rpc_method(resolve=ByReplyingRegionName())
    @abstractmethod
    def request_new_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        encrypt_with_public_key: bytes,
    ) -> None:
        """
        This helper method exists to facilitate calling `export_in_organization_scope` from one
        region to another. It performs the `export_in_organization_scope` call in the target region,
        but instead of merely writing the output to a file locally, it takes the bytes of the
        resulting tarball and (asynchronously, via a `RegionOutbox` handler that calls
        `reply_with_export`) sends them back over the wire using the `reply_with_export` method.

        This method always produces encrypted exports, so the caller must supply the correct public
        key in string form.
        """
        pass

    @regional_rpc_method(resolve=ByRequestingRegionName())
    @abstractmethod
    def reply_with_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
        encrypted_contents: bytes | None,
        encrypted_bytes: list[int] | None = None,
    ) -> None:
        """
        This method is responsible for asynchronously sending an already generated and locally-saved
        export tarball back from the exporting region to the region that requested the export.
        """
        pass


# See the comment on /src/sentry/relocation/tasks/process.py::uploading_start for a detailed description of
# how this service fits into the entire SAAS->SAAS relocation workflow.
class ControlRelocationExportService(RpcService):
    """
    Service that proxies asynchronous relocation export request and reply methods. The requesting
    and exporting region use this service as a middleman to enable inter-region communication. The
    actual export logic is contained in the `RegionRelocationExportService` that this proxy serves
    to connect.
    """

    key = "control_relocation_export"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.relocation.services.relocation_export.impl import (
            ProxyingRelocationExportService,
        )

        return ProxyingRelocationExportService()

    @rpc_method
    @abstractmethod
    def request_new_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        encrypt_with_public_key: bytes,
    ) -> None:
        """
        This helper method is a proxy handler for the `request_new_export` method, durably
        forwarding it from the requesting region to the exporting region by writing a retryable
        `ControlOutbox` entry.
        """
        pass

    @rpc_method
    @abstractmethod
    def reply_with_export(
        self,
        *,
        relocation_uuid: str,
        requesting_region_name: str,
        replying_region_name: str,
        org_slug: str,
        # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
        encrypted_contents: bytes | None,
        encrypted_bytes: list[int] | None = None,
    ) -> None:
        """
        This helper method is a proxy handler for the `reply_with_export` method, durably forwarding
        it from the requesting region to the exporting region by writing a retryable `ControlOutbox`
        entry.
        """
        pass


region_relocation_export_service = RegionRelocationExportService.create_delegation()
control_relocation_export_service = ControlRelocationExportService.create_delegation()
