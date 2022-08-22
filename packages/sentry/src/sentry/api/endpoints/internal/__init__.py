from .beacon import InternalBeaconEndpoint
from .environment import InternalEnvironmentEndpoint
from .mail import InternalMailEndpoint
from .packages import InternalPackagesEndpoint
from .queue_tasks import InternalQueueTasksEndpoint
from .quotas import InternalQuotasEndpoint
from .stats import InternalStatsEndpoint
from .warnings import InternalWarningsEndpoint

__all__ = (
    "InternalBeaconEndpoint",
    "InternalEnvironmentEndpoint",
    "InternalMailEndpoint",
    "InternalPackagesEndpoint",
    "InternalQueueTasksEndpoint",
    "InternalQuotasEndpoint",
    "InternalStatsEndpoint",
    "InternalWarningsEndpoint",
)
