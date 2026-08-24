import datetime
import logging
import math
from collections import defaultdict
from collections.abc import Generator, Sequence
from contextlib import contextmanager

from django.db import OperationalError, connections, transaction
from django.db.models import Count, Min
from django.utils import timezone

from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.hybridcloud.webhook_event_types import event_type_from_mailbox
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import hybridcloud_control_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


BACKLOG_AGE_QUERY_TIMEOUT = datetime.timedelta(seconds=5)
"""
Ceiling on the oldest-payload lookup below.

Reading the lowest live id walks past whatever dead index entries delivery has left
at the head of the primary key, so its cost tracks vacuum lag rather than backlog
size. Measured at ~830 buffers against a 2.6M row table, but nothing in the design
bounds it, so it gets an explicit bound.
"""

DEPTH_QUANTILES = (50, 90, 99)
"""
`max_depth` reads the same whether one mailbox is stuck or a provider's whole backlog
has shifted deeper. One is a mailbox to go look at, the other a capacity problem.
"""

MAILBOX_DEPTH_QUERY_TIMEOUT = datetime.timedelta(seconds=30)
"""
Ceiling on the per-mailbox aggregate below.

The aggregate is the one backlog query whose cost grows with the backlog, so it is
the one that could turn this monitor into a second incident. Bounding it means a
pathological table loses the per-provider breakdown rather than pinning a control
replica; the far cheaper `backlog.*` signals still report.
"""


def _nearest_rank(sorted_depths: Sequence[int], percentile: int) -> int:
    """
    Depth of the mailbox at `percentile` of an ascending `sorted_depths`.

    Nearest-rank, so every value returned is a depth some mailbox actually has. The
    clamp stops a low percentile from indexing -1 and returning the deepest instead.
    """
    index = math.ceil(percentile / 100 * len(sorted_depths)) - 1
    return sorted_depths[max(index, 0)]


@contextmanager
def _statement_timeout(alias: str, timeout: datetime.timedelta) -> Generator[None]:
    """
    Bound every query in this block server-side.

    A task deadline alone would abandon the query while the database kept executing
    it. `SET LOCAL` cancels it for real, and confines the setting to the surrounding
    transaction so it cannot leak into other work that reuses the connection.
    """
    with transaction.atomic(using=alias):
        with connections[alias].cursor() as cursor:
            cursor.execute(
                "SET LOCAL statement_timeout = %s", [int(timeout.total_seconds() * 1000)]
            )
        yield


@instrumented_task(
    name="sentry.hybridcloud.tasks.webhook_backlog_metrics.record_webhook_backlog_metrics",
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=20,
    silo_mode=SiloMode.CONTROL,
)
def record_webhook_backlog_metrics() -> None:
    """
    Emit the backlog signals cheap enough to keep reporting during a deep backlog.

    Every row in the table is a webhook we still owe a cell, so the backlog is the
    whole table. Size comes from the planner's row estimate and age from the lowest
    live id, which together cost ~1/1000th of the per-mailbox aggregate. That is what
    makes these safe to run frequently during the backlog they exist to report on.
    """
    replica = WebhookPayload.objects.using_replica()

    with connections[replica.db].cursor() as cursor:
        cursor.execute(
            "SELECT CAST(GREATEST(reltuples, 0) AS BIGINT) FROM pg_class WHERE relname = %s",
            [WebhookPayload._meta.db_table],
        )
        row = cursor.fetchone()
    if row is None:
        # No pg_class row for the table on this connection -- we don't have a
        # trustworthy answer, so skip rather than emit a 0. A 0 here reads as "no
        # backlog" and, blended into the host-tagged gauge's default aggregate
        # alongside hosts that got a real answer, silently drags the reported
        # average down. The age lookup below is independent, so it still runs.
        #
        # Warning, not error: whatever makes a specific replica connection see no
        # catalog row for this table is below what this task can diagnose or fix
        # (replica topology/routing, not application logic), so this is a signal
        # to watch via the counter rather than one to page on.
        metrics.incr(
            "hybridcloud.webhookpayload.backlog.pending_count_query_failed", sample_rate=1.0
        )
        logger.warning("webhook_backlog_metrics.pending_count_query_failed")
    else:
        # Autovacuum-maintained, so it trails reality on a churning table — measured
        # 0.13% below an exact count mid-backlog. `mailbox.pending_count` carries the
        # exact value.
        metrics.gauge(
            "hybridcloud.webhookpayload.backlog.pending_count_estimate",
            row[0],
            sample_rate=1.0,
        )

    # Ids are monotonic, so the lowest live id is the oldest undelivered payload.
    # Reading it in primary-key order stops at the first live row rather than
    # aggregating date_added, which has no index.
    try:
        with _statement_timeout(replica.db, BACKLOG_AGE_QUERY_TIMEOUT):
            oldest = replica.order_by("id").values_list("date_added", flat=True).first()
    except OperationalError:
        metrics.incr("hybridcloud.webhookpayload.backlog.age_query_failed", sample_rate=1.0)
        logger.exception("webhook_backlog_metrics.age_query_failed")
        return

    if oldest is None:
        # Nothing pending. Reporting an age of zero would read as "fully caught up"
        # rather than "nothing to be caught up on"; the estimate above covers liveness.
        return
    metrics.gauge(
        "hybridcloud.webhookpayload.backlog.oldest_pending_age_seconds",
        (timezone.now() - oldest).total_seconds(),
        sample_rate=1.0,
        unit="second",
    )


@instrumented_task(
    name="sentry.hybridcloud.tasks.webhook_backlog_metrics.record_mailbox_depth_metrics",
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=int(MAILBOX_DEPTH_QUERY_TIMEOUT.total_seconds() + 30),
    silo_mode=SiloMode.CONTROL,
)
def record_mailbox_depth_metrics() -> None:
    """
    Emit the per-provider backlog breakdown, including how deep the worst mailbox is.

    Delivery is ordered within a mailbox, so a single deep mailbox stalls every payload
    behind it while the totals still look healthy — `max_depth` is what makes that
    visible. Establishing it means aggregating every row, so this runs on a slower
    schedule than `record_webhook_backlog_metrics` and under a statement timeout.

    `pending_count` is additionally tagged by `event_type`, which says what the backlog
    is made of and joins to `github.webhook.forwarded_event`; summing over the tag
    reproduces the provider-only value. Only that metric — the rest read fine per
    provider, and every tag value costs a series per worker that runs the task.

    `depth_quantile` gives the shape behind `max_depth`. The depths are already in
    memory for the aggregates above, so it costs one sort per provider.
    """
    replica = WebhookPayload.objects.using_replica()
    mailboxes = replica.values("provider", "mailbox_name").annotate(
        depth=Count("id"), oldest=Min("date_added")
    )

    try:
        with _statement_timeout(replica.db, MAILBOX_DEPTH_QUERY_TIMEOUT):
            rows = list(mailboxes)
    except OperationalError:
        metrics.incr("hybridcloud.webhookpayload.mailbox.aggregate_failed", sample_rate=1.0)
        logger.exception("webhook_backlog_metrics.mailbox_depth_aggregate_failed")
        return

    now = timezone.now()
    pending: dict[tuple[str, str], int] = defaultdict(int)
    oldest: dict[str, datetime.datetime] = {}
    depths: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        # The column is nullable, and rows predating it still drain through here.
        provider = row["provider"] or "unknown"
        depth, row_oldest = row["depth"], row["oldest"]
        event_type = event_type_from_mailbox(provider, row["mailbox_name"])
        pending[(provider, event_type)] += depth
        oldest[provider] = min(oldest.get(provider, row_oldest), row_oldest)
        depths[provider].append(depth)

    for (provider, event_type), pending_count in pending.items():
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.pending_count",
            pending_count,
            tags={"provider": provider, "event_type": event_type},
            sample_rate=1.0,
        )

    for provider, mailbox_depths in depths.items():
        mailbox_depths.sort()
        tags = {"provider": provider}
        for percentile in DEPTH_QUANTILES:
            metrics.gauge(
                "hybridcloud.webhookpayload.mailbox.depth_quantile",
                _nearest_rank(mailbox_depths, percentile),
                tags={**tags, "quantile": f"p{percentile}"},
                sample_rate=1.0,
            )
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.active_count",
            len(mailbox_depths),
            tags=tags,
            sample_rate=1.0,
        )
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.max_depth",
            mailbox_depths[-1],
            tags=tags,
            sample_rate=1.0,
        )
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.oldest_pending_age_seconds",
            (now - oldest[provider]).total_seconds(),
            tags=tags,
            sample_rate=1.0,
            unit="second",
        )
