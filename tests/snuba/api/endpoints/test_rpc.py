import abc
import dataclasses

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation
from sentry.services.hybrid_cloud.rpc.endpoints import (
    expose_as_region_silo_rpc,
    impl_with_region_silo_client,
    routes_region_by_org_id,
)
from sentry.silo import SiloMode


@dataclasses.dataclass
class CoolRequestParams:
    a: int = -1
    b: str = ""
    organization_id: int = -1


class MyCoolService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def close(self) -> None:
        pass

    @abc.abstractmethod
    def cool_callsite(self, params: CoolRequestParams) -> str:
        pass


class TestMyCoolService(MyCoolService):
    def close(self) -> None:
        pass

    @routes_region_by_org_id
    def cool_callsite(self, params: CoolRequestParams) -> str:
        return f"{params.a}{params.b}"


def impl_my_cool_service() -> MyCoolService:
    return TestMyCoolService()


my_cool_service = silo_mode_delegation(
    {
        SiloMode.REGION: expose_as_region_silo_rpc("my_cool_service", impl_my_cool_service),
        SiloMode.CONTROL: impl_with_region_silo_client("my_cool_service", MyCoolService),
        SiloMode.MONOLITH: impl_my_cool_service,
    }
)


def test_rpc_e2e():
    # Try validating that calling my_cool_service from all the modes works correctly.
    pass
