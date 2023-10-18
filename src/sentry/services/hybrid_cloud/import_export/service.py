# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import List, Optional, Set, cast

from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportResult,
    RpcExportScope,
    RpcFilter,
    RpcPrimaryKeyMap,
)
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class ImportExportService(RpcService):
    key = "import_export"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.import_export.impl import UniversalImportExportService

        return UniversalImportExportService()

    @rpc_method
    @abstractmethod
    def export_by_model(
        self,
        *,
        model_name: str = "",
        from_pk: int = 0,
        scope: Optional[RpcExportScope] = None,
        filter_by: List[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        indent: int = 2,
    ) -> RpcExportResult:
        """
        Export models of a certain kind to JSON.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_all_globally_privileged_users(self) -> Set[int]:
        """
        Retrieves all of the "administrators" of the current instance.

        A user is defined as a "globally privileged" administrator if one of the following is true about them:

            - Their `User` model has the `is_staff` flag set to `True`.
            - Their `User` model has the `is_superuser` flag set to `True`.
            - Their `User.id` is mentioned at least once in the `UserPermission` table (ie, they
              have at least one global permission).
            - Their `User.id` is mentioned at least once in the `UserRoleUser` table (ie, they have
              at least one global user role).
        """
        pass


import_export_service: ImportExportService = cast(
    ImportExportService, ImportExportService.create_delegation()
)
