import datetime
import logging
from collections import defaultdict
from collections.abc import Generator
from contextlib import contextmanager

from django.db import OperationalError, connections, transaction
from django.db.models import Count, Min
from django.utils import timezone

from sentry.hybridcloud.models.webhookpayload import WebhookPayload
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

MAILBOX_DEPTH_QUERY_TIMEOUT = datetime.timedelta(seconds=30)
"""
Ceiling on the per-mailbox aggregate below.

The aggregate is the one backlog query whose cost grows with the backlog, so it is
the one that could turn this monitor into a second incident. Bounding it means a
pathological table loses the per-provider breakdown rather than pinning a control
replica; the far cheaper `backlog.*` signals still report.
"""


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
    # Autovacuum-maintained, so it trails reality on a churning table — measured 0.13%
    # below an exact count mid-backlog. `mailbox.pending_count` carries the exact value.
    metrics.gauge(
        "hybridcloud.webhookpayload.backlog.pending_count_estimate",
        row[0] if row else 0,
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
    pending: dict[str, int] = defaultdict(int)
    mailbox_count: dict[str, int] = defaultdict(int)
    max_depth: dict[str, int] = defaultdict(int)
    oldest: dict[str, datetime.datetime] = {}
    for row in rows:
        # The column is nullable, and rows predating it still drain through here.
        provider = row["provider"] or "unknown"
        depth, row_oldest = row["depth"], row["oldest"]
        pending[provider] += depth
        mailbox_count[provider] += 1
        max_depth[provider] = max(max_depth[provider], depth)
        oldest[provider] = min(oldest.get(provider, row_oldest), row_oldest)

    for provider, pending_count in pending.items():
        tags = {"provider": provider}
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.pending_count",
            pending_count,
            tags=tags,
            sample_rate=1.0,
        )
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.active_count",
            mailbox_count[provider],
            tags=tags,
            sample_rate=1.0,
        )
        metrics.gauge(
            "hybridcloud.webhookpayload.mailbox.max_depth",
            max_depth[provider],
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
