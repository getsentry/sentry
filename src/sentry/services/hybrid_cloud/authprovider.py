from abc import abstractmethod
from typing import List

from django.db.models import F

from sentry.models import AuthProvider
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


class AuthProviderService(InterfaceWithLifecycle):
    # TODO: Denormalize this scim enabled flag onto organizations?
    # This is potentially a large list
    @abstractmethod
    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        """
        This method returns a list of org ids that have scim enabled
        :return:
        """
        pass


class DatabaseAuthProviderService(AuthProviderService):
    def get_org_ids_with_scim(
        self,
    ) -> List[int]:
        return AuthProvider.objects.filter(
            flags=F("flags").bitor(AuthProvider.flags.scim_enabled)
        ).values_list("organization_id", flat=True)

    def close(self):
        pass


StubUserOptionService = CreateStubFromBase(DatabaseAuthProviderService)

auth_provider_service: AuthProviderService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseAuthProviderService,
        SiloMode.REGION: StubUserOptionService,
        SiloMode.CONTROL: DatabaseAuthProviderService,
    }
)
