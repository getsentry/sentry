# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.silo.base import SiloMode


class AwsSeerService(RpcService):
    """
    Seer runs in each cell, so each cell has its own AWS workload identity. This
    service only exposes that identity to control-silo setup code for the
    CloudFormation template; role verification never crosses silos through RPC.
    It runs in the organization's cell via its cell-silo verify-connection endpoint.
    """

    key = "aws_seer"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.integrations.services.aws_seer.impl import CellAwsSeerService

        return CellAwsSeerService()

    @cell_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_principal_arn(self, *, organization_id: int) -> str | None:
        """The ARN of the cell's Seer workload role, or None if the cell has not configured one."""


aws_seer_service = AwsSeerService.create_delegation()
