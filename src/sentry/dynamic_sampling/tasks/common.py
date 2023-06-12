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


def sample_rate_to_float(sample_rate: Optional[str]) -> Optional[float]:
    """
    Converts a sample rate to a float or returns None in case the conversion failed.
    """
    if sample_rate is None:
        return None

    try:
        return float(sample_rate)
    except (TypeError, ValueError):
        return None


def are_equal_with_epsilon(a: Optional[float], b: Optional[float]) -> bool:
    """
    Checks if two floating point numbers are equal within an error boundary.
    """
    if a is None and b is None:
        return True

    if a is None or b is None:
        return False

    return math.isclose(a, b)
