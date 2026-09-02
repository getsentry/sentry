import dataclasses
import datetime
import enum
import logging
import time
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import FIRST_COMPLETED, Future, wait
from typing import Any

import orjson
import sentry_sdk
from django.core.cache import cache
from django.db.models import Case, CharField, Count, Exists, Min, Q, Subquery, Value, When
from django.utils import timezone
from requests import Response
from requests.models import HTTPError
from rest_framework import status

from sentry import options
from sentry.exceptions import RestrictedIPAddress
from sentry.hybridcloud.models.webhookpayload import (
    BACKOFF_INTERVAL,
    MAX_ATTEMPTS,
    THE_PAST,
    DestinationType,
    WebhookPayload,
)
from sentry.hybridcloud.webhook_event_types import event_type_from_mailbox
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.client import CellSiloClient, SiloClientError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import hybridcloud_control_tasks
from sentry.types.cell import Cell, get_cell_by_name
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)

SLOW_DELIVERY_THRESHOLD = datetime.timedelta(minutes=10)
"""Duration threshold for logging slow webhook deliveries."""

MAX_MAILBOX_DRAIN = 300
"""
The maximum number of records that will be updated when scheduling a mailbox

More messages than this could be delivered if delivery is fast. We also limit
the runtime of any drain_mailbox operation to BATCH_SCHEDULE_OFFSET so that
a deep backlog doesn't soak up a worker indefinetly, and that slow but not timeout
slow forwarding yields to other tasks
"""


CELL_REQUEST_TIMEOUT = 12
"""Connect and read timeout, each, for one delivery request to a cell."""

REQUEST_BOUND = datetime.timedelta(seconds=2 * CELL_REQUEST_TIMEOUT + 2)
"""
The longest a delivery request can take and still come back: the connect and
read timeouts back to back, plus slack for the thread to hand the result over.
A request still in flight past it is stuck and is not waited for. Two things
the timeouts do not cover can put a request there: name resolution runs ahead
of the connect timeout, and the read timeout is per socket read, so a cell
that keeps trickling bytes outruns it.
"""

SETTLE_ALLOWANCE = datetime.timedelta(seconds=4)
"""
What a drain keeps back from its claim's deadline for the delete flush and the
release UPDATE once it has stopped waiting on requests.
"""

RELEASE_MARGIN = REQUEST_BOUND + SETTLE_ALLOWANCE
"""
How long before its claim's deadline a drain stops delivering and releases the
unworked tail back to the mailbox: long enough to wait out the requests in
flight at the stop, then settle, so the release lands while the claim holds.
"""


BATCH_SCHEDULE_OFFSET = datetime.timedelta(minutes=BACKOFF_INTERVAL)
"""
The time that batches are scheduled into the future when work starts.
Spacing batches out helps minimize competitive races when delivery is slow
but not at the timeout threshold
"""

BATCH_SIZE = 1000
"""The number of mailboxes a scheduler cycle aims to dispatch drains for."""

BATCH_SELECT_LIMIT = BATCH_SIZE * 10
"""
How many due mailbox heads a scheduler cycle selects to reach BATCH_SIZE
dispatches. Push triggers and concurrent cycles claim heads out of the selected
list before the loop reaches them, so selecting exactly BATCH_SIZE shrinks the
cycle below its target by whatever the contention share is. Heads the cycle
never reaches are handed to the next one (see CARRYOVER_CACHE_KEY) rather than
rediscovered.

Set far above BATCH_SIZE because the limit only bounds what the scan
materializes, and a surplus has to outlast contention to be worth carrying.
"""


MAX_DELIVERY_AGE = datetime.timedelta(days=3)
"""
The maximum age of a webhook we'll attempt to deliver.
The older a webhook gets the less valuable it is as there are likely other
actions that have been made to the relevant resources.
"""


DELETE_BATCH_SIZE = 100
"""
How many finished rows a batching drain accumulates before removing them. Small
enough that a crash strands at most this many rows until the claim horizon
passes.
"""

# Define priorities for different webhook providers
# Lower number means higher priority
#
# Deliberately unbacked by an index. A matching expression index was tried and went
# unused: the discovery query below must aggregate every mailbox to find the heads
# regardless, and sorting that small result beats scanning the table in priority
# order by orders of magnitude. Such an index also silently stops matching the
# moment this dict gains an entry, since the two expressions must be textually
# identical for Postgres to use it.
PROVIDER_PRIORITY = {
    "stripe": 1,
}
# Default priority for providers not explicitly listed above
DEFAULT_PROVIDER_PRIORITY = 10


UNKNOWN_PROVIDER = "unknown"
"""The payload predates the provider column, or the mailbox name carries no provider."""


def _provider_from_mailbox(mailbox_name: str | None) -> str:
    """
    Mailboxes are named `<provider>:<identifier>`, and it is the identifier that
    later gains bucket and event-type suffixes, so the first segment stays the
    provider.
    """
    provider, separator, _ = (mailbox_name or "").partition(":")
    return provider if separator and provider else UNKNOWN_PROVIDER


def _record_lost_head(
    payload_id: int, *, dispatcher: str | None, provider: str, log_key: str
) -> None:
    """
    Record a drain whose head row is already gone, delivered by whoever claimed it
    next. The drain stands down and lets that dispatcher, or a later one, continue.
    """
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**_delivery_tags(dispatcher, provider), "outcome": "race"},
    )
    logger.info(log_key, extra={"id": payload_id})


def _set_webhook_delivery_sentry_context(mailbox_name: str | None, provider: str) -> None:
    """Set Sentry context at the delivery entrypoint for easier debugging."""
    sentry_sdk.set_tag("mailbox_name", mailbox_name)
    sentry_sdk.set_attribute("mailbox_name", mailbox_name)
    context: dict[str, Any] = {"mailbox_name": mailbox_name, "provider": provider}
    sentry_sdk.set_context("webhook_delivery", context)
    sentry_sdk.set_attribute("webhook_delivery.provider", provider)


class DeliveryFailed(Exception):
    """
    Used to signal an expected delivery failure.
    """

    pass


class DeliveryDropped(Exception):
    """
    Signals that the cell rejected the payload in a way retrying cannot fix, so
    it is discarded instead of rescheduled.

    Distinct from `DeliveryFailed`, which is retryable. Both end in the payload
    being deleted, but only this one means the webhook never reached the cell,
    so callers must not count it as a delivery.

    `outcome` is the `delivery` metric tag describing why it was dropped.
    """

    def __init__(self, outcome: str) -> None:
        super().__init__(outcome)
        self.outcome = outcome


DRAIN_LOCK_TTL = 15
"""
Seconds the claim guard survives without a refresh. Dispatchers release it before
returning, so this is crash cover for one that died mid-claim.
"""


def _drain_lock_key(mailbox_name: str) -> str:
    return f"wh:drain_active:{mailbox_name}"


def _acquire_drain_guard(mailbox_name: str) -> bool | None:
    """
    Take the mailbox's claim guard.

    True when this caller holds it, False when another dispatcher does, None when
    the cache is unreachable — its own answer because the dispatchers diverge
    there: the scheduler claims unserialized, the push trigger stands down.
    """
    try:
        return bool(cache.add(_drain_lock_key(mailbox_name), 1, timeout=DRAIN_LOCK_TTL))
    except Exception:
        return None


def _release_drain_lock(mailbox_name: str) -> None:
    """Release the drain lock so push triggers and the scheduler can re-acquire it."""
    try:
        cache.delete(_drain_lock_key(mailbox_name))
    except Exception:
        pass


def _is_due(schedule_for: datetime.datetime) -> bool:
    """
    Whether a payload is ready to deliver.

    The in-Python mirror of the `schedule_for__lte=timezone.now()` bound that
    `_claim_mailbox_batch`'s due-gate applies in SQL. The push trigger is the
    only caller and short-circuits on it ahead of a claim, so move one, move both.
    """
    return schedule_for <= timezone.now()


def _dispatches_from_due_head(mailbox_name: str) -> bool:
    """
    Whether this mailbox dispatches from its oldest due record instead of gating
    on the absolute head. Only skip-on-failure providers qualify: their drains
    already deliver past failed records, so the head gate only parks every due
    record behind one failure's backoff.
    """
    if not options.get("hybridcloud.webhookpayload.dispatch_from_due_head"):
        return False
    provider = _provider_from_mailbox(mailbox_name)
    return provider in (options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ())


class Dispatcher(enum.StrEnum):
    """Which dispatcher enqueued a drain; a metric tag and a drain task argument."""

    PUSH = "push"
    SCHEDULER = "scheduler"
    CHAIN = "chain"


@dataclasses.dataclass(frozen=True)
class _MailboxClaim:
    """
    The records one claim reserved, and the context its drain works them under.

    `valid_until` is stored rather than re-derived, so it names exactly when the
    records come due for other dispatchers again.
    """

    claimed: int
    head_id: int
    mailbox_name: str
    dispatcher: str | None
    valid_until: datetime.datetime

    @property
    def provider(self) -> str:
        return _provider_from_mailbox(self.mailbox_name)

    @property
    def delivery_tags(self) -> dict[str, str]:
        return _delivery_tags(self.dispatcher, self.provider)

    @property
    def skip_on_failure(self) -> bool:
        """Whether this provider may skip a failed record rather than stop."""
        allowlist = options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ()
        return self.provider in allowlist

    @property
    def log_context(self) -> dict[str, Any]:
        return {"id": self.head_id, "mailbox_name": self.mailbox_name, "provider": self.provider}

    def task_args(self) -> dict[str, Any]:
        """
        This claim as a drain's task arguments; `_begin_drain` rebuilds it.

        Scalars only: the task codec carries no datetime, hence the epoch deadline.
        """
        return {
            "payload_id": self.head_id,
            "claimed_count": self.claimed,
            "dispatcher": self.dispatcher,
            "valid_until": self.valid_until.timestamp(),
            "mailbox": self.mailbox_name,
        }

    def lapsed(self, *, log_key: str, extra: Mapping[str, Any]) -> bool:
        """
        Whether this claim has lapsed, recording the stand-down when it has.

        The deadline bounds a drain at both ends — it must not start past its claim,
        nor keep delivering past it — so both report one outcome and `log_key`
        separates them. At the deadline exactly the claim is already lapsed: the due
        gates are `schedule_for__lte=now`.
        """
        if timezone.now() < self.valid_until:
            return False
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={**self.delivery_tags, "outcome": "delivery_deadline"},
        )
        logger.info(
            log_key,
            extra={
                **extra,
                "overshoot_seconds": (timezone.now() - self.valid_until).total_seconds(),
            },
        )
        return True

    def nearing_deadline(self) -> bool:
        """Whether to stop delivering and release, rather than run into the deadline mid-request."""
        return timezone.now() >= self.valid_until - RELEASE_MARGIN

    def release_remainder(self, next_id: int, *, extra: Mapping[str, Any]) -> int:
        """
        Return the claim's unworked tail to the mailbox so the next dispatcher can
        claim it now instead of at the deadline; returns how many rows went back.

        Matching the exact `schedule_for` this claim wrote is what makes the
        release safe: a record another claim took carries that claim's timestamp,
        and a record this drain failed and rescheduled carries its backoff — both
        pass untouched. A record that entered the claim already backing off is
        the exception: the claim rewrote its schedule (gated claims sweep the
        whole prefix), so releasing it forfeits what remained of that backoff.
        """
        released = WebhookPayload.objects.filter(
            mailbox_name=self.mailbox_name,
            id__gte=next_id,
            schedule_for=self.valid_until,
        ).update(schedule_for=THE_PAST)
        if released:
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery",
                amount=released,
                tags={**self.delivery_tags, "outcome": "released"},
            )
        logger.info("deliver_webhook.deadline_release", extra={**extra, "released": released})
        return released

    def record_cap_headroom(self) -> None:
        """
        Record how long this claim could still have delivered for when it ran out
        of records to deliver — the delivery time MAX_MAILBOX_DRAIN cost us.

        Only meaningful for a claim that filled the cap: a claim that took fewer
        records took every record the mailbox had due, so its leftover window
        measures the mailbox's depth rather than the cap's.
        """
        headroom = (self.valid_until - RELEASE_MARGIN - timezone.now()).total_seconds()
        metrics.incr(
            "hybridcloud.deliver_webhooks.drain.cap_headroom_seconds",
            amount=max(int(headroom), 0),
            tags=self.delivery_tags,
        )

    def records(self) -> list[WebhookPayload] | None:
        """
        The records this drain may deliver, or None when it must stand down: its
        head is gone, so whoever claimed the mailbox next is delivering these.

        Bounded to the claim: rows past it belong to whichever dispatcher claims
        them next, and delivering them here would race a drain that dispatcher
        may have started. The drain reads through here to keep the head check
        ahead of delivery — a drain that delivers first duplicates every row it
        sends.
        """
        records = list(
            WebhookPayload.objects.filter(
                id__gte=self.head_id, mailbox_name=self.mailbox_name
            ).order_by("id")[: self.claimed]
        )
        if not records or records[0].id != self.head_id:
            _record_lost_head(
                self.head_id,
                dispatcher=self.dispatcher,
                provider=self.provider,
                log_key="deliver_webhook.potential_race",
            )
            return None
        return records


class _PayloadDeleter:
    """
    Removes the rows a drain is finished with, whether they were delivered,
    discarded for exhausted attempts, or discarded as stale.

    Batching drains accumulate ids and remove them DELETE_BATCH_SIZE at a time
    rather than issuing one statement per row, which is most of the write
    traffic a drain generates on this delete-heavy table. Only the drain thread
    ever calls a deleter: parallel workers perform requests and hand their
    results back to the drain loop, so no locking is needed.

    Batching is safe because every drain is bounded to a claim its dispatcher
    owns: nothing else can touch a row between the drain finishing with it and
    deleting it. A worker that dies before flushing reprocesses at most one batch
    once the claim horizon passes — redelivering its delivered rows and
    re-discarding the rest — the same window a claim-then-crash already has.
    """

    def __init__(self, *, batched: bool) -> None:
        self._batched = batched
        self._pending: list[int] = []

    def delete(self, payload: WebhookPayload) -> None:
        """Remove the payload's row, either now or at the next flush."""
        if not self._batched:
            payload.delete()
            return
        self._pending.append(payload.id)
        if len(self._pending) >= DELETE_BATCH_SIZE:
            self.flush()

    def flush(self) -> None:
        """Remove every row accumulated since the last flush."""
        if not self._pending:
            return
        metrics.distribution("hybridcloud.deliver_webhooks.drain.delete_batch", len(self._pending))
        WebhookPayload.objects.filter(id__in=self._pending).delete()
        self._pending.clear()


def _begin_drain(
    payload_id: int,
    claimed_count: int,
    dispatcher: str | None,
    valid_until: float | None,
    mailbox: str | None,
) -> _MailboxClaim | None:
    """
    The claim a drain runs under, or None when it must stand down first.

    A drain enqueued before dispatch sent the mailbox and deadline reads both off
    its head row: its claim already wrote its deadline as the rows' schedule_for.
    That one-query fallback goes away once no such drains are left in flight.
    """
    deadline = (
        datetime.datetime.fromtimestamp(valid_until, tz=datetime.UTC)
        if valid_until is not None
        else None
    )
    if mailbox is None or deadline is None:
        head = (
            WebhookPayload.objects.filter(id=payload_id)
            .values_list("mailbox_name", "schedule_for")
            .first()
        )
        if head is None:
            # Whoever claimed the mailbox next is delivering the rest. Every
            # drain resolves through this read until dispatch sends the claim,
            # so this is where a lost race shows up.
            _record_lost_head(
                payload_id,
                dispatcher=dispatcher,
                provider=_provider_from_mailbox(mailbox),
                log_key="deliver_webhook.potential_race",
            )
            return None
        mailbox = mailbox if mailbox is not None else head[0]
        if deadline is None:
            # The head's schedule_for is normally the claim's own deadline, but
            # a failed attempt rewrites it to a retry backoff that passes the
            # deadline (the first backoff already does). Cap what a redelivered
            # drain adopts at the widest horizon its claim could have written.
            deadline = min(head[1], timezone.now() + BATCH_SCHEDULE_OFFSET)
    _set_webhook_delivery_sentry_context(mailbox, _provider_from_mailbox(mailbox))
    claim = _MailboxClaim(
        claimed=claimed_count,
        head_id=payload_id,
        mailbox_name=mailbox,
        dispatcher=dispatcher,
        valid_until=deadline,
    )
    if claim.lapsed(log_key="deliver_webhook.stale_claim", extra={"id": payload_id}):
        return None
    return claim


def _claim_mailbox_batch(
    head_id: int, mailbox_name: str, *, dispatcher: Dispatcher
) -> _MailboxClaim | None:
    """
    Claim up to MAX_MAILBOX_DRAIN records at the head of the mailbox by scheduling
    them past the drain deadline. The UPDATE gates on the head still being due, so
    a lost race claims nothing and returns None.

    In due-head mode the claim stops at the first not-due record, which is what
    keeps concurrent drains apart: an in-flight drain's records carry a future
    schedule_for, so a claim starting behind it ends before its range, and a
    backoff record keeps its backoff.
    """
    valid_until = timezone.now() + BATCH_SCHEDULE_OFFSET
    window = WebhookPayload.objects.filter(id__gte=head_id, mailbox_name=mailbox_name).order_by(
        "id"
    )
    claimed_ids: list[int] | Subquery
    if _dispatches_from_due_head(mailbox_name):
        now = timezone.now()
        prefix_ids: list[int] = []
        for record_id, schedule_for in window.values_list("id", "schedule_for")[:MAX_MAILBOX_DRAIN]:
            if schedule_for > now:
                break
            prefix_ids.append(record_id)
        if not prefix_ids:
            return None
        claimed_ids = prefix_ids
    else:
        claimed_ids = Subquery(window.values("id")[:MAX_MAILBOX_DRAIN])
    head_due = WebhookPayload.objects.filter(id=head_id, schedule_for__lte=timezone.now())
    claimed = (
        WebhookPayload.objects.filter(id__in=claimed_ids)
        .filter(Exists(head_due))
        .update(schedule_for=valid_until)
    )
    if not claimed:
        return None
    return _MailboxClaim(
        claimed=claimed,
        head_id=head_id,
        mailbox_name=mailbox_name,
        dispatcher=dispatcher,
        valid_until=valid_until,
    )


def _delivery_tags(dispatcher: str | None, provider: str) -> dict[str, str]:
    """
    The tags every delivery outcome carries: who dispatched the drain, and whose
    mailbox it is draining.

    `unknown` covers a drain invoked outside a dispatcher, and a mailbox name that
    carries no provider.
    """
    return {"dispatcher": dispatcher or "unknown", "provider": provider}


def _record_dispatch(*, dispatcher: Dispatcher, mailbox_name: str, claimed: int) -> None:
    """
    Record a drain enqueue so push- and scheduler-dispatched work stay comparable.

    `dispatch` counts enqueues; `dispatch.claimed` carries the claim behind each
    one. A scheduler drain can claim up to MAX_MAILBOX_DRAIN records where a push
    drain typically claims one or two, so the two shares are different numbers.
    """
    tags = {"dispatcher": dispatcher, "provider": _provider_from_mailbox(mailbox_name)}
    metrics.incr("hybridcloud.deliver_webhooks.dispatch", tags=tags)
    metrics.distribution("hybridcloud.deliver_webhooks.dispatch.claimed", claimed, tags=tags)


def _claim_and_dispatch(
    head_id: int, mailbox_name: str, *, dispatcher: Dispatcher, chain_depth: int = 1
) -> _MailboxClaim | None:
    """
    Claim a batch for the mailbox and dispatch its drain.
    Callers must hold the mailbox's drain lock so concurrent dispatchers cannot
    interleave around the claim.

    Returns the dispatched claim, or None when the head has already been
    claimed, delivered, or moved into a retry backoff. Dispatchers discover
    mailbox heads outside the drain lock, so the due-gate inside the claim is
    what stops two of them from double-dispatching the same head.

    The drain is bounded to the claimed records (`claimed_count`). Without the
    bound a fast drain walks past its claim into unclaimed rows, at which point
    the mailbox head is due again and another dispatcher can start a second,
    overlapping drain — duplicating deliveries and breaking mailbox ordering.

    `dispatcher` tags this dispatch and is forwarded to the drain so its
    deliveries carry the same attribution; every caller claims identically.
    `chain_depth` is the dispatched drain's link number — an ordinary dispatch
    starts a chain of one.
    """
    claim = _claim_mailbox_batch(head_id, mailbox_name, dispatcher=dispatcher)
    if claim is None:
        return None
    drain_mailbox.delay(**claim.task_args(), chain_depth=chain_depth)
    _record_dispatch(dispatcher=dispatcher, mailbox_name=mailbox_name, claimed=claim.claimed)
    return claim


def maybe_trigger_drain(mailbox_name: str) -> None:
    """Trigger an immediate drain if the mailbox head is due for delivery.

    Claims the batch exactly like the scheduler, so the claim — not the lock —
    keeps other dispatchers off the mailbox. The lock only serializes the claim
    and is always released before returning, never held for the drain's run.

    Runs inline in the inbound webhook request, so nothing may escape it: the whole
    body sits under the try, and every failure degrades to the scheduler delivering
    on its next cycle.
    """
    trigger_tags = {"provider": _provider_from_mailbox(mailbox_name)}
    guard = _acquire_drain_guard(mailbox_name)
    try:
        if guard is None:
            # Every inbound webhook reaches here, so an outage would otherwise
            # bury real faults under its own volume.
            metrics.incr(
                "hybridcloud.deliver_webhooks.push_trigger.error",
                tags={**trigger_tags, "reason": "cache_unavailable"},
            )
            return
        if not guard:
            metrics.incr("hybridcloud.deliver_webhooks.push_trigger.skipped", tags=trigger_tags)
            return
        # Only drain if the mailbox head is ready to deliver. In due-head mode the
        # head is the oldest due payload, so a failed payload in retry backoff at
        # the front delays only itself. Otherwise the head is the true head
        # (lowest ID), checked specifically — filtering by schedule_for there
        # would skip a claimed or backing-off head and return a later payload,
        # breaking head-of-line ordering.
        head_query = WebhookPayload.objects.filter(mailbox_name=mailbox_name)
        if _dispatches_from_due_head(mailbox_name):
            head_query = head_query.filter(schedule_for__lte=timezone.now())
        head = head_query.order_by("id").values_list("id", "schedule_for").first()
        if head is None or not _is_due(head[1]):
            # Mailbox is empty, drained by a claim already in flight, or in a retry
            # backoff — the scheduler covers it when schedule_for comes due.
            metrics.incr("hybridcloud.deliver_webhooks.push_trigger.backoff", tags=trigger_tags)
            return
        claim = _claim_and_dispatch(head[0], mailbox_name, dispatcher=Dispatcher.PUSH)
        if claim is None:
            # The head moved between our read and the claim; whoever moved it has
            # the mailbox covered.
            metrics.incr("hybridcloud.deliver_webhooks.push_trigger.backoff", tags=trigger_tags)
            return
        metrics.incr("hybridcloud.deliver_webhooks.push_trigger.success", tags=trigger_tags)
    except Exception:
        metrics.incr(
            "hybridcloud.deliver_webhooks.push_trigger.error",
            tags={**trigger_tags, "reason": "dispatch_failed"},
        )
    finally:
        # Only the guard this caller took; releasing unconditionally would
        # delete another dispatcher's.
        if guard:
            _release_drain_lock(mailbox_name)


def _gated_mailbox_heads() -> list[dict[str, Any]]:
    """
    Head-of-line discovery gated on the absolute mailbox head being due — the
    ordering guarantee for strict providers, and what keeps a mailbox to one
    drain at a time since claims always start at the true head.
    """
    # The double call to .values() ensures that the group by includes mailbox_name
    # but only id_min is selected
    head_of_line = (
        WebhookPayload.objects.all()
        .values("mailbox_name")
        .annotate(id_min=Min("id"))
        .values("id_min")
    )

    # Get any heads that are scheduled to run
    # Use provider field directly, with default priority for null values
    scheduled_mailboxes = (
        WebhookPayload.objects.filter(
            schedule_for__lte=timezone.now(),
            id__in=Subquery(head_of_line),
        )
        # Set priority value based on provider field
        .annotate(
            provider_priority=Case(
                # For providers that match our priority list
                *[
                    When(provider=provider, then=Value(priority))
                    for provider, priority in PROVIDER_PRIORITY.items()
                ],
                # Default value for all other cases (including null providers)
                default=Value(DEFAULT_PROVIDER_PRIORITY),
                output_field=CharField(),
            )
        )
        # Order by priority first (lowest number = highest priority), then ID
        .order_by("provider_priority", "id")
        .values("id", "mailbox_name")
    )

    records = list(scheduled_mailboxes[:BATCH_SELECT_LIMIT])
    # The selected batch already answers the metric for every normal cycle. Only
    # when it fills is the real number unknown, and only then is re-running the
    # head-of-line discovery worth it -- those wide cycles are the ones worth seeing.
    # `source` records which branch produced the value, so the share of cycles
    # still paying for the count query is visible rather than inferred.
    batch_full = len(records) == BATCH_SELECT_LIMIT
    mailbox_count = scheduled_mailboxes.count() if batch_full else len(records)
    metrics.distribution(
        "hybridcloud.schedule_webhook_delivery.mailbox_count",
        mailbox_count,
        tags={"source": "count_query" if batch_full else "batch"},
    )
    return records


def _record_backlog_depth(due_rows: Mapping[str, int], in_flight_rows: Mapping[str, int]) -> None:
    """
    Report the scanned backlog's depth per provider: due rows await dispatch,
    in-flight rows are held by claims and retry backoffs.
    """
    for provider, rows in due_rows.items():
        metrics.distribution(
            "hybridcloud.schedule_webhook_delivery.due_rows",
            rows,
            tags={"provider": provider},
        )
    for provider, rows in in_flight_rows.items():
        metrics.distribution(
            "hybridcloud.schedule_webhook_delivery.in_flight_rows",
            rows,
            tags={"provider": provider},
        )


def _due_mailbox_heads() -> list[dict[str, Any]]:
    """
    Discovery for due-head mode: one aggregate pass finds two mailbox records:
    unconditionally oldest and the oldest due record. Skip-on-failure providers
    dispatch from the oldest due record; strict providers still require the true
    head to be due (see `_gated_mailbox_heads`). Provider comes from the mailbox
    name — the aggregate never fetches rows.

    The same pass counts each mailbox's due and in-flight rows for the per-provider
    backlog metrics; it already visits every row to find the heads.
    """
    now = timezone.now()
    mailbox_heads = WebhookPayload.objects.values("mailbox_name").annotate(
        id_min=Min("id"),
        id_min_due=Min("id", filter=Q(schedule_for__lte=now)),
        due_count=Count("id", filter=Q(schedule_for__lte=now)),
        in_flight_count=Count("id", filter=Q(schedule_for__gt=now)),
    )
    skip_on_failure_providers = frozenset(
        options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ()
    )
    due_rows: defaultdict[str, int] = defaultdict(int)
    in_flight_rows: defaultdict[str, int] = defaultdict(int)
    heads = []
    for mailbox_head in mailbox_heads:
        provider = _provider_from_mailbox(mailbox_head["mailbox_name"])
        # Counted before the skips below: a mailbox that cannot dispatch is backlog
        # too, and omitting it would shrink depth exactly when a provider stalls.
        due_rows[provider] += mailbox_head["due_count"]
        in_flight_rows[provider] += mailbox_head["in_flight_count"]
        if mailbox_head["id_min_due"] is None:
            # Everything is claimed or backing off.
            continue
        if (
            provider not in skip_on_failure_providers
            and mailbox_head["id_min"] != mailbox_head["id_min_due"]
        ):
            # Strict-ordering provider whose true head is claimed or backing off.
            continue
        heads.append(
            (
                PROVIDER_PRIORITY.get(provider, DEFAULT_PROVIDER_PRIORITY),
                mailbox_head["id_min_due"],
                mailbox_head["mailbox_name"],
            )
        )
    # Priority first (lowest number wins), then head ID.
    heads.sort()
    # Exact even when the dispatch batch fills: the aggregate saw every mailbox.
    metrics.distribution(
        "hybridcloud.schedule_webhook_delivery.mailbox_count",
        len(heads),
        tags={"source": "aggregate"},
    )
    _record_backlog_depth(due_rows, in_flight_rows)
    return [
        {"id": head_id, "mailbox_name": mailbox_name}
        for _, head_id, mailbox_name in heads[:BATCH_SELECT_LIMIT]
    ]


CARRYOVER_CACHE_KEY = "wh:schedule:carryover"
"""Where a cycle leaves the due heads it discovered but had no budget to dispatch."""

CARRYOVER_TTL = 60
"""
Seconds a carried surplus stays dispatchable. Each cycle re-stores what it did
not spend, so this bounds only a surplus nobody is spending — not how long a
deep backlog defers discovery.
"""


def _read_carryover() -> list[dict[str, Any]]:
    """
    The heads a previous cycle discovered and left behind, empty when there are none.

    A cache failure reads as empty so the cycle falls back to discovery, which is
    what every cycle did before a surplus was carried at all.
    """
    try:
        return cache.get(CARRYOVER_CACHE_KEY) or []
    except Exception:
        metrics.incr(
            "hybridcloud.schedule_webhook_delivery.carryover.error", tags={"operation": "get"}
        )
        return []


def _store_carryover(records: Sequence[Mapping[str, Any]]) -> None:
    """
    Hand this cycle's undispatched heads to the next one.

    Stored as the head id and mailbox name a dispatch needs and nothing else: a
    cycle's worth of heads all sit in one cache value.
    """
    metrics.distribution("hybridcloud.schedule_webhook_delivery.carryover", len(records))
    try:
        cache.set(
            CARRYOVER_CACHE_KEY,
            [{"id": record["id"], "mailbox_name": record["mailbox_name"]} for record in records],
            timeout=CARRYOVER_TTL,
        )
    except Exception:
        metrics.incr(
            "hybridcloud.schedule_webhook_delivery.carryover.error", tags={"operation": "set"}
        )


def _clear_carryover() -> None:
    """Drop the spent surplus so the next cycle discovers again."""
    try:
        cache.delete(CARRYOVER_CACHE_KEY)
    except Exception:
        metrics.incr(
            "hybridcloud.schedule_webhook_delivery.carryover.error", tags={"operation": "delete"}
        )


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.schedule_webhook_delivery",
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CONTROL,
)
def schedule_webhook_delivery() -> None:
    """
    Find mailboxes that contain undelivered webhooks that were scheduled
    to be delivered now or in the past.

    Prioritizes webhooks based on provider importance.

    Discovery aggregates the whole table, so its cost grows with the backlog while
    it runs on a fixed short interval. A cycle that discovers more due heads than
    it can dispatch therefore hands the surplus to the next cycle instead of
    discarding it, and only a cycle that starts with nothing carried over pays for
    discovery — the deeper the backlog, the more of that scan is spared.

    A carried head may be stale by the time it is dispatched, which costs at most
    one claim attempt: `_claim_and_dispatch` gates every dispatch on the head still
    being due, so a head claimed, delivered, or backed off since discovery claims 0
    rows and is skipped. Mailboxes that arrive while a surplus is being spent are
    dispatched by their push trigger; the ones with none wait for it to drain.

    Triggered frequently by task-scheduler.
    """
    carryover = _read_carryover()
    if carryover:
        records = carryover
    else:
        # Discovery reads the primary rather than a replica. These reads run on a
        # short interval and can scan the whole table; on a replica they contend with
        # WAL replay and amplify replication lag, and lag also produces spurious
        # DoesNotExist races in the drains they enqueue (see INC-2398).
        if options.get("hybridcloud.webhookpayload.dispatch_from_due_head"):
            records = _due_mailbox_heads()
        else:
            records = _gated_mailbox_heads()
    metrics.incr(
        "hybridcloud.schedule_webhook_delivery.cycle",
        tags={"source": "carryover" if carryover else "discovery"},
    )

    dispatched = 0
    surplus: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        if dispatched >= BATCH_SIZE:
            # Dispatch target reached; the heads this cycle never reached go to the
            # next one, which dispatches them without rediscovering them.
            surplus = records[index:]
            break
        mailbox_name = record["mailbox_name"]
        skip_tags = {"provider": _provider_from_mailbox(mailbox_name)}
        guard = _acquire_drain_guard(mailbox_name)
        if guard is False:
            # Another dispatcher is mid-claim for this mailbox; it will dispatch.
            metrics.incr(
                "hybridcloud.deliver_webhooks.scheduler.skipped",
                tags={**skip_tags, "reason": "lock_held"},
            )
            continue
        # A None guard is a cache outage. Claims still keep dispatchers apart across
        # cycles, so proceed — just unserialized against push triggers.
        try:
            claim = _claim_and_dispatch(record["id"], mailbox_name, dispatcher=Dispatcher.SCHEDULER)
        finally:
            if guard:
                _release_drain_lock(mailbox_name)
        if claim is None:
            # Claimed out of the list between discovery and here, usually by a
            # push trigger.
            metrics.incr(
                "hybridcloud.deliver_webhooks.scheduler.skipped",
                tags={**skip_tags, "reason": "claim_lost"},
            )
        else:
            dispatched += 1

    # A carryover displaces the next cycle's discovery, so a short surplus costs it
    # the rest of its dispatch budget — below half a batch that outweighs the scan
    # it saves, and discovery finds those heads again.
    if len(surplus) >= BATCH_SIZE // 2:
        _store_carryover(surplus)
    else:
        if surplus:
            metrics.incr("hybridcloud.schedule_webhook_delivery.carryover.dropped")
        if carryover:
            _clear_carryover()


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox",
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox(
    payload_id: int,
    claimed_count: int,
    dispatcher: str | None = None,
    valid_until: float | None = None,
    mailbox: str | None = None,
    chain_depth: int = 1,
) -> None:
    """
    Deliver webhooks from the mailbox that `payload_id` is the head of.

    The arguments are one claim flattened for the wire (`_MailboxClaim.task_args`);
    each defaults so a rolling deploy can bind drains the previous version sent.
    `chain_depth` is which link of a chain this drain is, an ordinary dispatch
    being the first.
    """
    claim = _begin_drain(payload_id, claimed_count, dispatcher, valid_until, mailbox)
    if claim is None:
        return
    if _drain_mailbox(claim):
        _maybe_chain(claim, chain_depth)


def _maybe_chain(claim: _MailboxClaim, chain_depth: int) -> None:
    """
    Dispatch the mailbox's next claim directly, skipping the scheduler's
    re-discovery gap, while this lineage is within max_chain_depth links —
    at the option's default of 1 the ordinary dispatch is the whole chain.

    Strict providers only: their absolute-head gate admits one claim at a time,
    so a chain stays a single lineage per mailbox — a due-head provider would
    fork a new one every scheduler cycle. The claim gate still settles
    ownership; a concurrent dispatcher winning it continues the lineage.
    """
    if claim.skip_on_failure:
        return
    if chain_depth >= options.get("hybridcloud.webhookpayload.max_chain_depth"):
        return
    mailbox_name = claim.mailbox_name
    guard = _acquire_drain_guard(mailbox_name)
    if not guard:
        # Held by another dispatcher, or the cache is unreachable: either way
        # the scheduler covers the mailbox.
        return
    try:
        head = (
            WebhookPayload.objects.filter(mailbox_name=mailbox_name)
            .order_by("id")
            .values_list("id", "schedule_for")
            .first()
        )
        if head is not None and _is_due(head[1]):
            _claim_and_dispatch(
                head[0], mailbox_name, dispatcher=Dispatcher.CHAIN, chain_depth=chain_depth + 1
            )
    except Exception:
        # This drain's work is already delivered; failing the task here would
        # only retry a finished drain. The scheduler picks the mailbox up.
        logger.exception("deliver_webhook.chain_failed")
    finally:
        if guard:
            _release_drain_lock(mailbox_name)


def _drain_mailbox(claim: _MailboxClaim) -> bool:
    """
    Deliver the claimed records until a strict provider's record fails, the claim
    nears its deadline, or all of them have been processed.

    Skip-on-failure claims deliver on `worker_threads` threads. Strict claims
    deliver on one: concurrent requests complete in arbitrary order, so a
    strict-ordering provider would be delivered out of order exactly when its
    mailbox is deep.

    Returns whether the drain was healthy and left due work behind — it consumed
    a full claim, or released a tail it had been delivering toward — the signal
    `_maybe_chain` acts on.
    """
    records = claim.records()
    if records is None:
        return False
    skip_on_failure = claim.skip_on_failure
    delivery_tags = claim.delivery_tags
    worker_threads = 1
    if skip_on_failure:
        worker_threads = max(
            1, min(options.get("hybridcloud.webhookpayload.worker_threads"), len(records))
        )
    deleter = _PayloadDeleter(batched=options.get("hybridcloud.webhookpayload.drain_batch_deletes"))
    pool = _DeliveryPool(
        deleter,
        worker_threads=worker_threads,
        delivery_tags=delivery_tags,
        valid_until=claim.valid_until,
        # A drain killed mid-request leaves no result to reschedule on, so the
        # record would be retried at every claim horizon until it is stale. A
        # strict provider's record head-blocks its mailbox all that while, so
        # its attempt is spent before the request goes out — one extra write per
        # record, which the high-volume skip-on-failure providers are spared:
        # due-head dispatch simply passes over such a record.
        spends_attempt_on_submit=not skip_on_failure,
    )
    walk = iter(records)
    # The first id not yet handed to the pool: where a release starts.
    frontier = claim.head_id
    chain = False
    try:
        while True:
            extra = {**claim.log_context, "delivered": pool.delivered}
            if claim.lapsed(log_key="deliver_webhook.delivery_deadline", extra=extra):
                pool.wind_down(reason="lapsed")
                break
            if claim.nearing_deadline():
                # Settle and flush before releasing, so a request that completes
                # late cannot land on a row another dispatcher has since claimed,
                # and no delivered row is released ahead of its delete.
                lowest_cancelled = pool.wind_down(reason="deadline")
                deleter.flush()
                overshoot = (timezone.now() - claim.valid_until).total_seconds()
                if overshoot >= 0:
                    # The in-flight requests outran RELEASE_MARGIN: the rows have
                    # been claimable again since the deadline, so anything settled
                    # after it may have been delivered twice.
                    logger.warning(
                        "deliver_webhook.release_overshoot",
                        extra={**claim.log_context, "overshoot_seconds": overshoot},
                    )
                released = claim.release_remainder(
                    frontier if lowest_cancelled is None else lowest_cancelled,
                    extra={**claim.log_context, "delivered": pool.delivered},
                )
                # A drain that delivered nothing before its soft-stop spent its
                # window in the queue — saturation, exactly when a chain would
                # add queue load.
                chain = released > 0 and pool.failed == 0 and pool.delivered > 0
                break
            while pool.has_room and (record := next(walk, None)) is not None:
                # Advance past the record before it is delivered: a delete clears
                # pk on the in-memory instance, and a failed record — left with a
                # future schedule_for — must not be re-attempted by this drain.
                frontier = record.id + 1
                # Stale and attempts-exhausted rows are discarded in place of
                # delivery, consuming claim budget like any delivered row rather
                # than being swept out from under the claim.
                if not _discard_if_exhausted(
                    record, deleter, delivery_tags=delivery_tags
                ) and not _discard_if_stale(record, deleter, delivery_tags=delivery_tags):
                    pool.submit(record)
            if pool.idle:
                if pool.failed > 0:
                    logger.info(
                        "deliver_webhook.delivery_complete_with_failures",
                        extra={**extra, "failed": pool.failed},
                    )
                else:
                    logger.debug("deliver_webhook.delivery_complete", extra=extra)
                # A claim at the cap saw nothing but due records and stopped at
                # the boundary, so the prefix likely continues past it.
                chain = pool.failed == 0 and len(records) == MAX_MAILBOX_DRAIN
                if chain:
                    claim.record_cap_headroom()
                break
            if not pool.wait_one():
                # Every request in flight has outrun REQUEST_BOUND: the cell is
                # not answering. Stop rather than feed it more, and leave the
                # tail parked under the claim instead of releasing it — a
                # dispatcher would only send the next drain into the same cell.
                logger.warning(
                    "deliver_webhook.cell_unresponsive",
                    extra={**extra, "in_flight": pool.in_flight},
                )
                pool.wind_down(reason="stuck", patience=0)
                break
            if pool.unexpected is not None:
                pool.wind_down(reason="error")
                break
            if pool.failed > 0 and not skip_on_failure:
                # For providers that require strict ordering, stop on the first
                # failure so subsequent messages are not delivered out of order.
                # The failed record has already been rescheduled.
                break
    finally:
        pool.wind_down(reason="cleanup")
        deleter.flush()
    if pool.unexpected is not None:
        raise pool.unexpected
    return chain


class _DeliveryPool:
    """
    Delivery for one drain: a fixed set of threads, each handed the next record as
    soon as it finishes its last, so a slow request holds up only its own thread.

    Workers only perform requests. Every result is handled on the drain thread,
    which is what lets `_PayloadDeleter` go unlocked.
    """

    def __init__(
        self,
        deleter: _PayloadDeleter,
        *,
        worker_threads: int,
        delivery_tags: Mapping[str, str],
        valid_until: datetime.datetime,
        spends_attempt_on_submit: bool,
    ) -> None:
        self._deleter = deleter
        self._delivery_tags = delivery_tags
        self._valid_until = valid_until
        self._settle_by = valid_until - SETTLE_ALLOWANCE
        self._spends_attempt_on_submit = spends_attempt_on_submit
        self._capacity = worker_threads
        self._executor = ContextPropagatingThreadPoolExecutor(max_workers=worker_threads)
        self._in_flight: dict[Future[tuple[WebhookPayload, Exception | None]], WebhookPayload] = {}
        self.delivered = 0
        self.failed = 0
        self.unexpected: Exception | None = None
        """
        The first error a result handler raised. The drain winds down and then
        re-raises it rather than raising mid-stream: rows other threads already
        delivered would never be deleted, then be redelivered under a later claim.
        """

    @property
    def has_room(self) -> bool:
        return len(self._in_flight) < self._capacity

    @property
    def idle(self) -> bool:
        return not self._in_flight

    @property
    def in_flight(self) -> int:
        return len(self._in_flight)

    def submit(self, record: WebhookPayload) -> None:
        if self._spends_attempt_on_submit:
            record.schedule_next_attempt()
        self._in_flight[self._executor.submit(deliver_message, record)] = record

    def wait_one(self) -> bool:
        """
        Block until a request finishes, then handle every result that is in.
        False when none finished inside REQUEST_BOUND: every request in flight
        has then been out for at least that long, so all of them are stuck.
        """
        if not self._in_flight:
            return True
        done, _ = wait(
            self._in_flight, timeout=REQUEST_BOUND.total_seconds(), return_when=FIRST_COMPLETED
        )
        self._handle(done)
        return bool(done)

    def wind_down(self, *, reason: str, patience: float | None = None) -> int | None:
        """
        Stop delivering: cancel the requests that have not started, wait out the
        ones that have, and handle their results. Returns the lowest cancelled id
        — a cancelled record was never attempted, so a release must start there —
        or None when every submitted request ran.

        Every unworked record was either cancelled here or never submitted, and
        the unsubmitted ones sit past everything submitted, so the lowest
        cancelled id is below them all. Rows above it that were worked are
        settled by then, so the release's `schedule_for` match passes them by.

        The wait lasts at most `patience` seconds — by default REQUEST_BOUND,
        or what is left before the settle deadline, whichever is shorter — and
        is recorded under `reason` whenever there was something to wait for.
        Requests still running after that are abandoned (`_abandon`), and the
        executor is shut down without joining their threads.
        """
        cancelled_ids = [record.id for future, record in self._in_flight.items() if future.cancel()]
        self._in_flight = {
            future: record for future, record in self._in_flight.items() if not future.cancelled()
        }
        if self._in_flight:
            if patience is None:
                remaining = (self._settle_by - timezone.now()).total_seconds()
                patience = max(0.0, min(REQUEST_BOUND.total_seconds(), remaining))
            started = time.monotonic()
            done, stuck = wait(self._in_flight, timeout=patience)
            metrics.distribution(
                "hybridcloud.deliver_webhooks.drain.wind_down_ms",
                (time.monotonic() - started) * 1000,
                tags={**self._delivery_tags, "reason": reason},
                unit="millisecond",
            )
            self._handle(done)
            self._abandon(stuck)
        self._executor.shutdown(wait=False)
        return min(cancelled_ids, default=None)

    def _abandon(self, stuck: Iterable[Future[tuple[WebhookPayload, Exception | None]]]) -> None:
        """
        Give up on requests the drain will not wait for. Each counts as a failed
        attempt: the record goes into its retry backoff, so a request that never
        answers cannot be retried at every claim horizon until the record is
        stale. Nothing reads the result, so a late success is redelivered once
        after the backoff. The thread finishes when its socket does — or, for a
        cell that keeps trickling bytes, when the worker process does.

        Once the claim has lapsed the rows are due, and possibly another
        dispatcher's already, so they are left as they are.
        """
        lapsed = timezone.now() >= self._valid_until
        for future in stuck:
            if future.done():
                # It came back while the results ahead of it were being handled.
                self._handle([future])
                continue
            record = self._in_flight.pop(future)
            self.failed += 1
            # Unsampled: rare, and each one is a request the cell never answered.
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery",
                tags={**self._delivery_tags, "outcome": "abandoned"},
                sample_rate=1.0,
            )
            logger.warning("deliver_webhook.abandoned", extra=record.as_dict())
            if not self._spends_attempt_on_submit and not lapsed:
                record.schedule_next_attempt()

    def _handle(self, done: Iterable[Future[tuple[WebhookPayload, Exception | None]]]) -> None:
        for future in done:
            del self._in_flight[future]
            payload_record, err = future.result()
            if isinstance(err, DeliveryFailed):
                self.failed += 1
            try:
                if _handle_delivery_result(
                    payload_record,
                    err,
                    self._deleter,
                    delivery_tags=self._delivery_tags,
                    attempt_spent=self._spends_attempt_on_submit,
                ):
                    self.delivered += 1
            except Exception as handler_err:
                if self.unexpected is None:
                    self.unexpected = handler_err


def _discard_if_stale(
    payload: WebhookPayload, deleter: _PayloadDeleter, *, delivery_tags: Mapping[str, str]
) -> bool:
    """
    Discard the payload when it is older than MAX_DELIVERY_AGE; returns whether
    it was discarded. Runs per record inside the drain walk, so stale rows
    consume claim budget like any other processed row instead of being deleted
    out-of-band from under a claim.
    """
    if payload.date_added > timezone.now() - MAX_DELIVERY_AGE:
        return False
    payload_data = payload.as_dict()
    deleter.delete(payload)
    # Warning + unsampled: a discard permanently drops a webhook, and the count
    # wants an exact total rather than an estimated rate.
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**delivery_tags, "outcome": "max_age"},
        sample_rate=1.0,
    )
    logger.warning("deliver_webhook.max_age_discard", extra={**payload_data})
    return True


def _discard_if_exhausted(
    payload: WebhookPayload, deleter: _PayloadDeleter, *, delivery_tags: Mapping[str, str]
) -> bool:
    """
    Discard the payload when its delivery attempts are spent; returns whether it
    was discarded. Checked before the request so an exhausted record never gets
    an extra attempt.
    """
    if payload.attempts < MAX_ATTEMPTS:
        return False
    deleter.delete(payload)
    # Unsampled: this is the count of webhooks we permanently dropped, so it
    # wants an exact total rather than an estimated rate.
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**delivery_tags, "outcome": "attempts_exceed"},
        sample_rate=1.0,
    )
    logger.warning("deliver_webhook.discard", extra={**payload.as_dict()})
    return True


def _record_delivery_time_metrics(
    payload: WebhookPayload, *, delivery_tags: Mapping[str, str]
) -> None:
    """Record delivery time metrics for a successfully delivered webhook payload.

    Measured from `date_added`, so this is queue wait plus retry backoff plus the
    request itself — the span dispatch is meant to shorten. It carries the same
    attribution as the outcome counter so latency can be compared per dispatcher
    rather than only in aggregate.
    """
    duration = timezone.now() - payload.date_added
    provider = _provider_from_mailbox(payload.mailbox_name)
    tags = {
        **delivery_tags,
        "region_sent_to": payload.cell_name,
        # The unit delivery queues by, and bounded to one value per mailbox shape.
        "event_type": event_type_from_mailbox(provider, payload.mailbox_name),
    }
    metrics.distribution(
        "hybridcloud.deliver_webhooks.delivery_time_ms",
        # e.g. 0.123 seconds → 123 milliseconds
        duration.total_seconds() * 1000,
        tags=tags,
        unit="millisecond",
    )


def _finish_delivered(
    payload: WebhookPayload, deleter: _PayloadDeleter, *, delivery_tags: Mapping[str, str]
) -> None:
    """Remove a delivered payload and record the delivery."""
    payload_data = payload.as_dict()
    date_added = payload.date_added
    deleter.delete(payload)
    _record_delivery_time_metrics(payload, delivery_tags=delivery_tags)
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**delivery_tags, "outcome": "ok"},
    )
    if timezone.now() - date_added >= SLOW_DELIVERY_THRESHOLD:
        logger.warning("deliver_webhook.slow_delivery", extra=payload_data)


def _handle_delivery_result(
    payload_record: WebhookPayload,
    err: Exception | None,
    deleter: _PayloadDeleter,
    *,
    delivery_tags: Mapping[str, str],
    attempt_spent: bool,
) -> bool:
    """
    Process one result from the delivery pool; returns whether the payload was
    delivered. An unexpected `err` is re-raised, after the reschedule so its
    record keeps a retry.

    A failed record is rescheduled into its retry backoff unless `attempt_spent`
    says the pool already did so on submission (`_DeliveryPool`) — until one or
    the other, the record still carries its claim's schedule_for.
    """
    if isinstance(err, DeliveryDropped):
        # Permanently rejected, so it is neither a delivery nor a retryable failure:
        # drop it and let the drain continue to the next record.
        deleter.delete(payload_record)
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={**delivery_tags, "outcome": err.outcome},
        )
        return False
    if err:
        # Attempts-exhausted rows are discarded before delivery, so a failure here
        # always has a retry left; the reschedule spends it.
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={**delivery_tags, "outcome": "retry"},
        )
        if not attempt_spent:
            payload_record.schedule_next_attempt()
        if not isinstance(err, DeliveryFailed):
            raise err
        return False
    _finish_delivered(payload_record, deleter, delivery_tags=delivery_tags)
    return True


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel",
    namespace=hybridcloud_control_tasks,
    # The pre-merge task's deadline, kept for the in-flight drains this shim serves.
    processing_deadline_duration=int(BATCH_SCHEDULE_OFFSET.total_seconds() + 10),
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox_parallel(
    payload_id: int,
    claimed_count: int,
    dispatcher: str | None = None,
    valid_until: float | None = None,
    mailbox: str | None = None,
    chain_depth: int = 1,
) -> None:
    """
    Transitional alias from when sequential and parallel delivery were separate
    tasks. Dispatch no longer enqueues this, so it is deletable once no drains
    from the previous deploy are left in flight.
    """
    claim = _begin_drain(payload_id, claimed_count, dispatcher, valid_until, mailbox)
    if claim is not None:
        _drain_mailbox(claim)


def deliver_message(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
    """
    Deliver one payload on a pool thread, handing any error back with it: the
    result is processed on the drain thread (`_handle_delivery_result`).
    """
    try:
        perform_request(payload)
        return (payload, None)
    except Exception as err:
        return (payload, err)


def perform_request(payload: WebhookPayload) -> None:
    destination_type = payload.destination_type

    match destination_type:
        case DestinationType.SENTRY_CELL:
            assert payload.cell_name is not None
            cell = get_cell_by_name(name=payload.cell_name)
            perform_cell_request(cell, payload)


def perform_cell_request(cell: Cell, payload: WebhookPayload) -> None:
    try:
        client = CellSiloClient(cell=cell)
        with metrics.timer(
            "hybridcloud.deliver_webhooks.send_request",
            tags={"destination_region": cell.name},
        ):
            headers = orjson.loads(payload.request_headers)
            response = client.request(
                method=payload.request_method,
                path=payload.request_path,
                headers=headers,
                # We need to send the body as raw bytes to avoid interfering with webhook signatures
                data=payload.request_body.encode("utf-8"),
                json=False,
                timeout=CELL_REQUEST_TIMEOUT,
            )
        logger.debug(
            "deliver_webhooks.success",
            extra={
                "status": getattr(
                    response, "status_code", 204
                ),  # Request returns empty dict instead of a response object when the code is a 204
                **payload.as_dict(),
            },
        )
    except ApiHostError as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={
                "reason": "host_error",
                "destination_region": cell.name,
                "provider": _provider_from_mailbox(payload.mailbox_name),
            },
        )
        with sentry_sdk.isolation_scope() as scope:
            scope.set_context(
                "region",
                {
                    "name": cell.name,
                    "address": cell.address,
                },
            )
            err_cause = err.__cause__
            if err_cause is not None and isinstance(err_cause, RestrictedIPAddress):
                # Cell silos that are IP address restricted are actionable.
                silo_client_err = SiloClientError("Cell silo is IP address restricted")
                silo_client_err.__cause__ = err
                sentry_sdk.capture_exception(silo_client_err)
                raise DeliveryFailed()

            sentry_sdk.capture_exception(err)
        logger.warning(
            "deliver_webhooks.host_error", extra={"error": str(err), **payload.as_dict()}
        )
        raise DeliveryFailed() from err
    except ApiConflictError as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={
                "reason": "conflict",
                "destination_region": cell.name,
                "provider": _provider_from_mailbox(payload.mailbox_name),
            },
        )
        logger.warning(
            "deliver_webhooks.conflict_occurred",
            extra={"conflict_text": err.text, **payload.as_dict()},
        )
        # We don't retry conflicts as those are explicit failure code to drop webhook.
        raise DeliveryDropped("conflict") from err
    except (ApiTimeoutError, ApiConnectionResetError) as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={
                "reason": "timeout_reset",
                "destination_region": cell.name,
                "provider": _provider_from_mailbox(payload.mailbox_name),
            },
        )
        logger.warning("deliver_webhooks.timeout_error", extra=payload.as_dict())
        raise DeliveryFailed() from err
    except ApiError as err:
        err_cause = err.__cause__
        response_code = -1
        if isinstance(err_cause, HTTPError):
            orig_response: Response | None = err_cause.response
            if orig_response is not None:
                response_code = orig_response.status_code

            # We need to retry on cell 500s
            if status.HTTP_500_INTERNAL_SERVER_ERROR <= response_code < 600:
                raise DeliveryFailed() from err

            # We don't retry 404 or 400 as they will fail again.
            if response_code in {400, 401, 403, 404}:
                reason = "not_found"
                if response_code == 400:
                    reason = "bad_request"
                elif response_code == 401:
                    reason = "unauthorized"
                elif response_code == 403:
                    reason = "forbidden"
                metrics.incr(
                    "hybridcloud.deliver_webhooks.failure",
                    tags={
                        "reason": reason,
                        "destination_region": cell.name,
                        "provider": _provider_from_mailbox(payload.mailbox_name),
                    },
                )
                logger.warning(
                    "deliver_webhooks.40x_error",
                    extra={"reason": reason, **payload.as_dict()},
                )
                raise DeliveryDropped("dropped_4xx") from err

        # Other ApiErrors should be retried
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={
                "reason": "api_error",
                "destination_region": cell.name,
                "provider": _provider_from_mailbox(payload.mailbox_name),
            },
        )
        logger.warning(
            "deliver_webhooks.api_error",
            extra={"error": str(err), "response_code": response_code, **payload.as_dict()},
        )
        raise DeliveryFailed() from err
