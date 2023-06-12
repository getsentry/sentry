import logging
import math
from datetime import timedelta
from typing import Dict, Optional, Sequence, Tuple

import sentry_sdk

from sentry import options, quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.models.transactions_rebalancing import TransactionsRebalancingInput
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.dynamic_sampling.prioritise_transactions import (
    ProjectTransactions,
    fetch_project_transaction_totals,
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    transactions_zip,
)
from sentry.dynamic_sampling.recalibrate_transactions import (
    OrganizationDataVolume,
    fetch_org_volumes,
)
from sentry.dynamic_sampling.rules.base import (
    is_sliding_window_enabled,
    is_sliding_window_org_enabled,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import (
    generate_prioritise_by_project_cache_key,
    get_prioritise_by_project_sample_rate,
)
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import (
    SLIDING_WINDOW_CALCULATION_ERROR,
    extrapolate_monthly_volume,
    generate_sliding_window_cache_key,
    generate_sliding_window_org_cache_key,
    get_sliding_window_org_sample_rate,
    get_sliding_window_sample_rate,
    get_sliding_window_size,
    mark_sliding_window_executed,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.rules.utils import (
    DecisionDropCount,
    DecisionKeepCount,
    OrganizationId,
    ProjectId,
    adjusted_factor,
    generate_cache_key_rebalance_factor,
    get_redis_client_for_ds,
)
from sentry.dynamic_sampling.sliding_window import (
    fetch_orgs_with_total_root_transactions_count,
    fetch_projects_with_total_root_transactions_count,
)
from sentry.dynamic_sampling.snuba_utils import (
    get_active_orgs,
    get_orgs_with_project_counts_without_modulo,
)
from sentry.models import Organization, Project
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def log_extrapolated_monthly_volume(
    org_id: int, project_id: Optional[int], volume: int, extrapolated_volume: int, window_size: int
) -> None:
    extra = {
        "org_id": org_id,
        "volume": volume,
        "extrapolated_monthly_volume": extrapolated_volume,
        "window_size_in_hours": window_size,
    }

    if project_id is not None:
        extra["project_id"] = project_id

    logger.info(
        "dynamic_sampling.extrapolate_monthly_volume",
        extra=extra,
    )


def log_sample_rate_source(
    org_id: int, project_id: Optional[int], used_for: str, source: str, sample_rate: Optional[float]
) -> None:
    extra = {"org_id": org_id, "sample_rate": sample_rate, "source": source, "used_for": used_for}

    if project_id is not None:
        extra["project_id"] = project_id

    logger.info(
        "dynamic_sampling.sample_rate_source",
        extra=extra,
    )
