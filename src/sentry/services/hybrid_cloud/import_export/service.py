# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Callable, List, Optional, Set, Type

from django.db.models.base import Model

from sentry.backup.helpers import ImportFlags
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportResult,
    RpcExportScope,
    RpcFilter,
    RpcImportFlags,
    RpcImportResult,
    RpcImportScope,
    RpcPrimaryKeyMap,
)
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode

DEFAULT_IMPORT_FLAGS = RpcImportFlags.into_rpc(ImportFlags())


class ImportExportService(RpcService):
    """
    A service for bulk importing and exporting models to and from JSON. All import/export operations
    must be triggered from either a REGION or MONOLITH silo, but never from the CONTROL silo.

    Unlike most other RPC services, the `..._by_model` methods in this service select their
    implementations (local vs remote) based on their inputs. Specifically, they choose whether or
    not to perform the underlying operation in the REGION (where all import/export operations must
    start) or the CONTROL silo depending on the model being imported (aka the `model_name`
    argument): if the model is a REGION model, the operation proceeds locally, whereas for CONTROL
    models, an RPC call is made into the CONTROL silo.

    In cases where Sentry is running in MONOLITH mode, the local implementation is always used,
    since that is the only one available.
    """

    key = "import_export"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.import_export.impl import UniversalImportExportService

        return UniversalImportExportService()

    @rpc_method
    @abstractmethod
    def import_by_model(
        self,
        *,
        model_name: str = "",
        scope: Optional[RpcImportScope] = None,
        flags: RpcImportFlags = DEFAULT_IMPORT_FLAGS,
        filter_by: List[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        json_data: str = "",
    ) -> RpcImportResult:
        """
        Import models of a certain kind from JSON source. Do not call this method directly - use
        `get_importer_for_model` to select the correct implementation for the specific model being
        imported.
        """
        pass

    @staticmethod
    def get_importer_for_model(
        model: Type[Model],
    ) -> Callable:
        """
        Called should resolve their implementation of `export_by_model` by calling this method
        first, rather than calling `export_by_model` directly. See this class' comment for more
        information.
        """

        if SiloMode.CONTROL in model._meta.silo_limit.modes:  # type: ignore
            return import_export_service.import_by_model
        return ImportExportService.get_local_implementation().import_by_model  # type: ignore

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
        Export models of a certain kind to JSON. Do not call this method directly - use
        `get_exporter_for_model` to select the correct implementation for the specific model being
        exported.
        """
        pass

    @staticmethod
    def get_exporter_for_model(
        model: Type[Model],
    ) -> Callable:
        """
        Called should resolve their implementation of `export_by_model` by calling this method
        first, rather than calling `export_by_model` directly. See this class' comment for more
        information.
        """

        if SiloMode.CONTROL in model._meta.silo_limit.modes:  # type: ignore
            return import_export_service.export_by_model
        return ImportExportService.get_local_implementation().export_by_model  # type: ignore

    @rpc_method
    @abstractmethod
    def get_all_globally_privileged_users(self) -> Set[int]:
        """
        Retrieves all of the "administrators" of the current instance.

        A user is defined as a "globally privileged" administrator if one of the following is true
        about them:

            - Their `User` model has the `is_staff` flag set to `True`.
            - Their `User` model has the `is_superuser` flag set to `True`.
            - Their `User.id` is mentioned at least once in the `UserPermission` table (ie, they
              have at least one global permission).
            - Their `User.id` is mentioned at least once in the `UserRoleUser` table (ie, they have
              at least one global user role).
        """
        pass


import_export_service = ImportExportService.create_delegation()
