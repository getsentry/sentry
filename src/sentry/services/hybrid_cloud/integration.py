# from abc import abstractmethod
# from dataclasses import dataclass
# from enum import Enum
# from typing import Any, Optional
#
# from django.db.models import F
#
# from sentry.services.hybrid_cloud import (
#     CreateStubFromBase,
#     InterfaceWithLifecycle,
#     silo_mode_delegation,
# )
# from sentry.silo import SiloMode
#
#
# @dataclass
# class ApiIntegration:
#     dsn_public: str = ""
#
#
# class ProjectKeyService(InterfaceWithLifecycle):
#     @abstractmethod
#     def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
#         pass
#
#
# class DatabaseBackedProjectKeyService(ProjectKeyService):
#     def close(self) -> None:
#         pass
#
#     def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
#         from sentry.models import ProjectKey
#
#         project_keys = ProjectKey.objects.filter(
#             project=project_id, roles=F("roles").bitor(role.as_orm_role())
#         )
#
#         if project_keys:
#             return ApiProjectKey(dsn_public=project_keys[0].dsn_public)
#
#         return None
#
#
# StubProjectKeyService = CreateStubFromBase(DatabaseBackedProjectKeyService)
#
#
# project_key_service: ProjectKeyService = silo_mode_delegation(
#     {
#         SiloMode.MONOLITH: lambda: DatabaseBackedProjectKeyService(),
#         SiloMode.REGION: lambda: DatabaseBackedProjectKeyService(),
#         SiloMode.CONTROL: lambda: StubProjectKeyService(),
#     }
# )
