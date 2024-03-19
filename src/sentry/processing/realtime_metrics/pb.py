import logging
from collections.abc import Iterable

import grpc

from . import base, project_budget_pb2, project_budget_pb2_grpc

logger = logging.getLogger(__name__)

# The timeout for rpc calls, in seconds.
# We expect these to be very quick, and never want to block more than 5 ms.
RPC_TIMEOUT = 5 / 1000  # timeout in seconds

# NOTE:
# The `project_budgets_XXX` files are auto-generated through:
#
# ```sh
# python -m grpc_tools.protoc \
#   --proto_path=../peanutbutter/proto/ \
#   --python_out=src/sentry/processing/realtime_metrics/ \
#   --pyi_out=src/sentry/processing/realtime_metrics/ \
#   --grpc_python_out=src/sentry/processing/realtime_metrics/ \
#   ../peanutbutter/proto/project_budget.proto
# ```
#
# The generated `XXX_pb2_grpc.py` file is then modified to fix us the broken `import`.
# I really wish this would be simpler :-(


class PbRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, target: str):
        self.channel = grpc.insecure_channel(target)
        self.stub = project_budget_pb2_grpc.ProjectBudgetsStub(self.channel)

    def record_project_duration(self, project_id: int, duration: float) -> None:
        request = project_budget_pb2.RecordSpendingRequest(
            config_name="symbolication.native", project_id=project_id, spent=duration
        )
        try:
            self.stub.RecordSpending(request, timeout=RPC_TIMEOUT)
        except grpc.RpcError:
            pass

    def is_lpq_project(self, project_id: int) -> bool:
        request = project_budget_pb2.ExceedsBudgetRequest(
            config_name="symbolication.native", project_id=project_id
        )
        try:
            response = self.stub.ExceedsBudget(request, timeout=RPC_TIMEOUT)
            return response.exceeds_budget
        except grpc.RpcError:
            # On any error (timeout or otherwise), the failure condition is to not
            # consider projects to have exceeded their budget.
            return False

    # NOTE: The functions below are just default impls copy-pasted from `DummyRealtimeMetricsStore`.
    # They are not used in the actual implementation of recording budget spend,
    # and checking if a project is within its budget.

    def validate(self) -> None:
        pass

    def projects(self) -> Iterable[int]:
        yield from ()

    def get_used_budget_for_project(self, project_id: int) -> float:
        return 0.0

    def get_lpq_projects(self) -> set[int]:
        return set()

    def add_project_to_lpq(self, project_id: int) -> bool:
        return False

    def remove_projects_from_lpq(self, project_ids: set[int]) -> int:
        return 0
