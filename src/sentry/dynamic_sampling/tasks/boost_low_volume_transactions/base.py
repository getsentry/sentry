from sentry import options, quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.transactions_rebalancing import TransactionsRebalancingInput
from sentry.dynamic_sampling.rules.base import (
    is_sliding_window_enabled,
    is_sliding_window_org_enabled,
)
from sentry.dynamic_sampling.rules.helpers.prioritise_project import (
    get_prioritise_by_project_sample_rate,
)
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.helpers.sliding_window import get_sliding_window_sample_rate
from sentry.dynamic_sampling.tasks.boost_low_volume_transactions.utils import (
    ProjectTransactions,
    fetch_project_transaction_totals,
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    transactions_zip,
)
from sentry.dynamic_sampling.tasks.constants import CACHE_KEY_TTL
from sentry.dynamic_sampling.tasks.logging import log_sample_rate_source
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.models import Organization
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_transactions",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task()
def boost_low_volume_transactions() -> None:
    num_big_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions")
    )
    num_small_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_small_transactions")
    )

    for orgs in get_orgs_with_project_counts():
        # get the low and high transactions
        for project_transactions in transactions_zip(
            fetch_project_transaction_totals(orgs),
            fetch_transactions_with_total_volumes(
                orgs,
                large_transactions=True,
                max_transactions=num_big_trans,
            ),
            fetch_transactions_with_total_volumes(
                orgs,
                large_transactions=False,
                max_transactions=num_small_trans,
            ),
        ):
            boost_low_volume_transactions_of_project.delay(project_transactions)


@instrumented_task(
    name="sentry.dynamic_sampling.process_transaction_biases",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,
    time_limit=2 * 60 + 5,
)
@dynamic_sampling_task()
def boost_low_volume_transactions_of_project(project_transactions: ProjectTransactions) -> None:
    org_id = project_transactions["org_id"]
    project_id = project_transactions["project_id"]
    total_num_transactions = project_transactions.get("total_num_transactions")
    total_num_classes = project_transactions.get("total_num_classes")
    transactions = [
        RebalancedItem(id=id, count=count)
        for id, count in project_transactions["transaction_counts"]
    ]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        organization = None

    # By default, this bias uses the blended sample rate.
    sample_rate = quotas.get_blended_sample_rate(organization_id=org_id)

    # In case we have specific feature flags enabled, we will change the sample rate either basing ourselves
    # on sliding window per project or per org.
    if organization is not None and is_sliding_window_enabled(organization):
        sample_rate = get_sliding_window_sample_rate(
            org_id=org_id, project_id=project_id, error_sample_rate_fallback=sample_rate
        )
        log_sample_rate_source(
            org_id, project_id, "prioritise_by_transaction", "sliding_window", sample_rate
        )
    elif organization is not None and is_sliding_window_org_enabled(organization):
        sample_rate = get_prioritise_by_project_sample_rate(
            org_id=org_id, project_id=project_id, error_sample_rate_fallback=sample_rate
        )
        log_sample_rate_source(
            org_id, project_id, "prioritise_by_transaction", "prioritise_by_project", sample_rate
        )
    else:
        log_sample_rate_source(
            org_id, project_id, "prioritise_by_transaction", "blended_sample_rate", sample_rate
        )

    if sample_rate is None or sample_rate == 1.0:
        # no sampling => no rebalancing
        return

    intensity = options.get("dynamic-sampling.prioritise_transactions.rebalance_intensity", 1.0)

    model = model_factory(ModelType.TRANSACTIONS_REBALANCING)
    rebalanced_transactions = guarded_run(
        model,
        TransactionsRebalancingInput(
            classes=transactions,
            sample_rate=sample_rate,
            total_num_classes=total_num_classes,
            total=total_num_transactions,
            intensity=intensity,
        ),
    )
    # In case the result of the model is None, it means that an error occurred, thus we want to early return.
    if rebalanced_transactions is None:
        return

    # Only after checking the nullability of rebalanced_transactions, we want to unpack the tuple.
    named_rates, implicit_rate = rebalanced_transactions
    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=project_id,
        named_rates=named_rates,
        default_rate=implicit_rate,
        ttl_ms=CACHE_KEY_TTL,
    )

    schedule_invalidate_project_config(
        project_id=project_id, trigger="dynamic_sampling_prioritise_transaction_bias"
    )
