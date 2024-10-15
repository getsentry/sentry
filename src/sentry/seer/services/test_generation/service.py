# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.hybridcloud.rpc.resolvers import ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.seer.services.test_generation.model import CreateUnitTestResponse
from sentry.silo.base import SiloMode


class TestGenerationService(RpcService):
    """
    Used in github webhooks to call regional seer for copilot requests.
    """

    key = "test_generation"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.seer.services.test_generation.impl import RegionBackedTestGenerationService

        return RegionBackedTestGenerationService()

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def start_unit_test_generation(
        self, *, region_name: str, github_org: str, repo: str, pr_id: int, external_id: str
    ) -> CreateUnitTestResponse:
        pass


test_generation_service = TestGenerationService.create_delegation()
