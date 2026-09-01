import datetime
import enum
import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from concurrent.futures import as_completed
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


PARALLEL_DRAIN_THRESHOLD = MAX_MAILBOX_DRAIN // 5
"""
Mailbox depth at which delivery switches from sequential to parallel: past it the
mailbox is behind, and parallel throughput is worth the loss of strict ordering.
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
How many finished rows a batching drain accumulates before removing them.
Sized to the sequential drain's read slice so a flush lands roughly per slice,
and small enough that a crash strands at most this many rows until the claim
horizon passes.
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


def _provider_tag(payload: WebhookPayload) -> str:
    """The provider column is nullable, and rows predating it still drain through here."""
    return payload.provider or UNKNOWN_PROVIDER


def _provider_from_mailbox(mailbox_name: str | None) -> str:
    """
    Recover the provider where only the mailbox name is in hand.

    Mailboxes are named `<provider>:<identifier>`, and it is the identifier that later
    gains bucket and event-type suffixes, so the first segment stays the provider.
    """
    provider, separator, _ = (mailbox_name or "").partition(":")
    return provider if separator and provider else UNKNOWN_PROVIDER


def _set_webhook_delivery_sentry_context(payload: WebhookPayload) -> None:
    """Set Sentry context at webhook delivery entrypoint for easier debugging."""
    sentry_sdk.set_tag("mailbox_name", payload.mailbox_name)
    sentry_sdk.set_attribute("mailbox_name", payload.mailbox_name)
    context: dict[str, str] = {
        "mailbox_name": payload.mailbox_name,
        "provider": payload.provider or "unknown",
    }
    sentry_sdk.set_context("webhook_delivery", context)
    sentry_sdk.set_attribute("webhook_delivery.provider", payload.provider or "unknown")


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


def _claim_mailbox_batch(head_id: int, mailbox_name: str) -> int:
    """
    Claim up to MAX_MAILBOX_DRAIN records at the head of the mailbox by scheduling
    them past the drain deadline, keeping other dispatchers off the mailbox while
    the drain runs. The claim is gated on the head still being due via the
    UPDATE's WHERE clause, so a lost race claims 0 rows.

    In due-head mode the claim stops at the first not-due record. That stop keeps
    concurrent drains apart: an in-flight drain's records carry a future
    schedule_for, so a claim starting behind it ends before its range, and a
    backoff record keeps its backoff. As a prefix, the drain's (head, count) walk
    covers exactly the claimed records.

    Returns the number of records claimed — also the depth signal that picks the
    drain mode.
    """
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
            return 0
        claimed_ids = prefix_ids
    else:
        claimed_ids = Subquery(window.values("id")[:MAX_MAILBOX_DRAIN])
    head_due = WebhookPayload.objects.filter(id=head_id, schedule_for__lte=timezone.now())
    return (
        WebhookPayload.objects.filter(id__in=claimed_ids)
        .filter(Exists(head_due))
        .update(schedule_for=timezone.now() + BATCH_SCHEDULE_OFFSET)
    )


class DispatchOutcome(enum.StrEnum):
    """What `_claim_and_dispatch` did for a mailbox; doubles as a metric tag."""

    NOT_DUE = "not_due"
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"


class Dispatcher(enum.StrEnum):
    """Which dispatcher enqueued a drain; a metric tag and a drain task argument."""

    PUSH = "push"
    SCHEDULER = "scheduler"


def _dispatch_tags(dispatcher: str | None) -> dict[str, str]:
    """
    Attribute a drain's deliveries to the dispatcher that enqueued it.

    `unknown` covers drains enqueued before this argument deployed, and drains
    invoked directly rather than through a dispatcher.
    """
    return {"dispatcher": dispatcher or "unknown"}


def _record_dispatch(
    *,
    dispatcher: Dispatcher,
    drain: DispatchOutcome,
    mailbox_name: str,
    claimed: int,
) -> None:
    """
    Record a drain enqueue so push- and scheduler-dispatched work stay comparable.

    `dispatch` counts enqueues; `dispatch.claimed` carries the claim behind each
    one. A scheduler drain can claim up to MAX_MAILBOX_DRAIN records where a push
    drain typically claims one or two, so the two shares are different numbers.
    """
    tags = {
        "dispatcher": dispatcher,
        "drain": drain,
        "provider": _provider_from_mailbox(mailbox_name),
    }
    metrics.incr("hybridcloud.deliver_webhooks.dispatch", tags=tags)
    metrics.distribution("hybridcloud.deliver_webhooks.dispatch.claimed", claimed, tags=tags)


def _claim_and_dispatch(
    head_id: int, mailbox_name: str, *, dispatcher: Dispatcher
) -> DispatchOutcome:
    """
    Claim a batch for the mailbox and dispatch the drain matching its depth.
    Callers must hold the mailbox's drain lock so concurrent dispatchers cannot
    interleave around the claim.

    Returns the dispatched drain's mode, or NOT_DUE when the head has already
    been claimed, delivered, or moved into a retry backoff. Dispatchers discover
    mailbox heads outside the drain lock, so the due-gate inside the claim is
    what stops two of them from double-dispatching the same head.

    The drain is bounded to the claimed records (`claimed_count`). Without the
    bound a fast drain walks past its claim into unclaimed rows, at which point
    the mailbox head is due again and another dispatcher can start a second,
    overlapping drain — duplicating deliveries and breaking mailbox ordering.

    `dispatcher` tags this dispatch and is forwarded to the drain so its
    deliveries carry the same attribution; both callers claim identically.
    """
    claimed = _claim_mailbox_batch(head_id, mailbox_name)
    if not claimed:
        return DispatchOutcome.NOT_DUE
    if claimed >= PARALLEL_DRAIN_THRESHOLD:
        drain_mailbox_parallel.delay(head_id, claimed_count=claimed, dispatcher=dispatcher)
        outcome = DispatchOutcome.PARALLEL
    else:
        drain_mailbox.delay(head_id, claimed_count=claimed, dispatcher=dispatcher)
        outcome = DispatchOutcome.SEQUENTIAL
    _record_dispatch(
        dispatcher=dispatcher,
        drain=outcome,
        mailbox_name=mailbox_name,
        claimed=claimed,
    )
    return outcome


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
        outcome = _claim_and_dispatch(head[0], mailbox_name, dispatcher=Dispatcher.PUSH)
        if outcome is DispatchOutcome.NOT_DUE:
            # The head moved between our read and the claim; whoever moved it has
            # the mailbox covered.
            metrics.incr("hybridcloud.deliver_webhooks.push_trigger.backoff", tags=trigger_tags)
            return
        metrics.incr(
            "hybridcloud.deliver_webhooks.push_trigger.success",
            tags={**trigger_tags, "drain": outcome},
        )
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
            outcome = _claim_and_dispatch(
                record["id"], mailbox_name, dispatcher=Dispatcher.SCHEDULER
            )
        finally:
            if guard:
                _release_drain_lock(mailbox_name)
        if outcome is DispatchOutcome.NOT_DUE:
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
) -> None:
    """
    Deliver webhooks from the mailbox that `payload_id` is the head of.

    Messages will be delivered in order until one fails, the batch deadline is
    reached, or `claimed_count` records have been processed. Once messages have
    successfully been delivered or discarded, they are deleted.

    This drain holds no lock while it runs, so it must not deliver past the
    `claimed_count` records its dispatcher claimed — beyond them the mailbox head
    is due again and another dispatcher may have started a drain of its own.

    `dispatcher` carries the enqueueing dispatcher's attribution onto every
    delivery outcome this drain records (see `_dispatch_tags`).
    """
    dispatch_tags = _dispatch_tags(dispatcher)
    try:
        payload = WebhookPayload.objects.get(id=payload_id)
    except WebhookPayload.DoesNotExist:
        # We could have hit a race condition. Since we've lost already return
        # and let the other process continue, or a future process.
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            # The row is gone, so nothing left in hand names the provider.
            tags={**dispatch_tags, "outcome": "race", "provider": UNKNOWN_PROVIDER},
        )
        logger.info("deliver_webhook.potential_race", extra={"id": payload_id})
        return

    _set_webhook_delivery_sentry_context(payload)

    skip_on_failure_providers = frozenset(
        options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ()
    )
    skip_on_failure = payload.provider in skip_on_failure_providers

    deleter = _deleter_for()

    delivered = 0
    failed = 0
    remaining = claimed_count
    current_id = payload.id
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    try:
        while True:
            # We have run until the end of our batch schedule delay. Break the loop so this worker can take another
            # task.
            if timezone.now() >= deadline:
                logger.info(
                    "deliver_webhook.delivery_deadline",
                    extra={
                        **payload.as_dict(),
                        "delivered": delivered,
                    },
                )
                metrics.incr(
                    "hybridcloud.deliver_webhooks.delivery",
                    tags={
                        **dispatch_tags,
                        "outcome": "delivery_deadline",
                        "provider": _provider_tag(payload),
                    },
                )
                break

            # Fetch records from the batch in slices of 100. This avoids reading
            # redundant data should we hit an error and should help keep query duration low.
            query = WebhookPayload.objects.filter(
                id__gte=current_id, mailbox_name=payload.mailbox_name
            ).order_by("id")

            slice_size = min(100, remaining)
            batch_count = 0
            for record in query[:slice_size]:
                batch_count += 1
                # Advance past this record regardless of outcome so that failed
                # messages are not re-attempted in subsequent batches of this drain.
                current_id = record.id + 1
                try:
                    if deliver_message(record, deleter, dispatch_tags=dispatch_tags):
                        delivered += 1
                except DeliveryFailed:
                    failed += 1
                    metrics.incr(
                        "hybridcloud.deliver_webhooks.delivery",
                        tags={
                            **dispatch_tags,
                            "outcome": "retry",
                            "provider": _provider_tag(record),
                        },
                    )
                    if not skip_on_failure:
                        # For providers that require strict ordering, stop on the
                        # first failure so subsequent messages are not delivered
                        # out of order.
                        return
                    # For allowlisted providers: skip the failed message and
                    # continue. It has already been rescheduled by deliver_message.
                    continue

            # No more messages to deliver
            if batch_count < 1:
                if failed > 0:
                    logger.info(
                        "deliver_webhook.delivery_complete_with_failures",
                        extra={
                            **payload.as_dict(),
                            "delivered": delivered,
                            "failed": failed,
                        },
                    )
                else:
                    logger.debug(
                        "deliver_webhook.delivery_complete",
                        extra={
                            **payload.as_dict(),
                            "delivered": delivered,
                        },
                    )
                return

            remaining -= batch_count
            if remaining <= 0:
                # Claim exhausted. Rows past this point belong to whichever
                # dispatcher claims them next; delivering them here would race
                # a drain that dispatcher may have started.
                logger.debug(
                    "deliver_webhook.claim_exhausted",
                    extra={
                        **payload.as_dict(),
                        "delivered": delivered,
                    },
                )
                metrics.incr(
                    "hybridcloud.deliver_webhooks.delivery",
                    tags={**dispatch_tags, "outcome": "claim_exhausted"},
                )
                return
    finally:
        deleter.flush()


class _PayloadDeleter:
    """
    Removes the rows a drain is finished with, whether they were delivered,
    discarded for exhausted attempts, or discarded as stale.

    Batching drains accumulate ids and remove them DELETE_BATCH_SIZE at a time
    rather than issuing one statement per row, which is most of the write
    traffic a drain generates on this delete-heavy table. Only the drain thread
    ever calls a deleter: parallel workers perform requests and hand their
    results back to the drain loop, so no locking is needed.
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


def _deleter_for() -> _PayloadDeleter:
    """
    Build the deleter for a drain.

    Batching is safe because every drain is bounded to a claim its dispatcher
    owns: nothing else can touch a row between the drain finishing with it and
    deleting it. A worker that dies before flushing reprocesses at most one batch
    once the claim horizon passes — redelivering its delivered rows and
    re-discarding the rest — the same window a claim-then-crash already has.
    """
    return _PayloadDeleter(batched=options.get("hybridcloud.webhookpayload.drain_batch_deletes"))


def _discard_if_stale(
    payload: WebhookPayload, deleter: _PayloadDeleter, *, dispatch_tags: Mapping[str, str]
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
        tags={**dispatch_tags, "outcome": "max_age", "provider": _provider_tag(payload)},
        sample_rate=1.0,
    )
    logger.warning("deliver_webhook.max_age_discard", extra={**payload_data})
    return True


def _record_delivery_time_metrics(
    payload: WebhookPayload, *, dispatch_tags: Mapping[str, str]
) -> None:
    """Record delivery time metrics for a successfully delivered webhook payload.

    Measured from `date_added`, so this is queue wait plus retry backoff plus the
    request itself — the span dispatch is meant to shorten. It carries the same
    attribution as the outcome counter so latency can be compared per dispatcher
    rather than only in aggregate.
    """
    duration = timezone.now() - payload.date_added
    provider = _provider_tag(payload)
    tags = {
        **dispatch_tags,
        "region_sent_to": payload.cell_name,
        "provider": provider,
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


def _handle_parallel_delivery_result(
    payload_record: WebhookPayload,
    err: Exception | None,
    deleter: _PayloadDeleter,
    *,
    dispatch_tags: Mapping[str, str],
) -> tuple[bool, bool]:
    """
    Process one result from the parallel delivery threadpool.
    Returns (request_failed, should_reraise).
    """
    payload_data = payload_record.as_dict()
    if isinstance(err, DeliveryDropped):
        # Permanently rejected, so it is neither a delivery nor a retryable failure:
        # drop it and let the drain continue to the next record.
        deleter.delete(payload_record)
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={
                **dispatch_tags,
                "outcome": err.outcome,
                "provider": _provider_tag(payload_record),
            },
        )
        return (False, False)
    if err:
        if payload_record.attempts >= MAX_ATTEMPTS:
            deleter.delete(payload_record)
            # Unsampled: this is the count of webhooks we permanently dropped, so it
            # wants an exact total rather than an estimated rate.
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery",
                tags={
                    **dispatch_tags,
                    "outcome": "attempts_exceed",
                    "provider": _provider_tag(payload_record),
                },
                sample_rate=1.0,
            )
            logger.warning(
                "deliver_webhook_parallel.discard",
                extra={**payload_data},
            )
            request_failed = False
        else:
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery",
                tags={
                    **dispatch_tags,
                    "outcome": "retry",
                    "provider": _provider_tag(payload_record),
                },
            )
            payload_record.schedule_next_attempt()
            request_failed = True
        return (request_failed, not isinstance(err, DeliveryFailed))
    date_added = payload_record.date_added
    deleter.delete(payload_record)
    _record_delivery_time_metrics(payload_record, dispatch_tags=dispatch_tags)
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**dispatch_tags, "outcome": "ok", "provider": _provider_tag(payload_record)},
    )
    if timezone.now() - date_added >= SLOW_DELIVERY_THRESHOLD:
        logger.warning("deliver_webhook.slow_delivery", extra=payload_data)
    return (False, False)


def _run_parallel_delivery_batch(
    mailbox_name: str,
    start_id: int,
    batch_size: int,
    deleter: _PayloadDeleter,
    *,
    dispatch_tags: Mapping[str, str],
) -> tuple[int, int, bool, int | None]:
    """
    Run one batch of up to `batch_size` parallel deliveries for the mailbox.

    Returns (attempted_count, delivered_count, request_failed, next_start_id).
    `next_start_id` is one past the highest id attempted in this batch so callers
    can advance past failed rows when continuing (e.g. skip-on-failure providers).
    Returns `next_start_id=None` when the mailbox has no rows at/after `start_id`.
    """
    records = list(
        WebhookPayload.objects.filter(id__gte=start_id, mailbox_name=mailbox_name).order_by("id")[
            :batch_size
        ]
    )
    if not records:
        return (0, 0, False, None)

    # Capture before delivery/discard — an immediate delete clears pk on the
    # in-memory instance.
    next_start_id = records[-1].id + 1
    attempted = len(records)

    # Stale rows are discarded in place of delivery, consuming claim budget
    # like any delivered row rather than being swept out from under the claim.
    fresh_records = [
        record
        for record in records
        if not _discard_if_stale(record, deleter, dispatch_tags=dispatch_tags)
    ]

    delivered = 0
    request_failed = False
    if fresh_records:
        with ContextPropagatingThreadPoolExecutor(max_workers=batch_size) as threadpool:
            futures = {
                threadpool.submit(deliver_message_parallel, record) for record in fresh_records
            }
            for future in as_completed(futures):
                payload_record, err = future.result()
                batch_request_failed, should_reraise = _handle_parallel_delivery_result(
                    payload_record, err, deleter, dispatch_tags=dispatch_tags
                )
                request_failed = request_failed or batch_request_failed
                if should_reraise and err is not None:
                    raise err
                if err is None:
                    delivered += 1
    return (attempted, delivered, request_failed, next_start_id)


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel",
    namespace=hybridcloud_control_tasks,
    # Give more time than the threadpool delivery deadline
    processing_deadline_duration=int(BATCH_SCHEDULE_OFFSET.total_seconds() + 10),
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox_parallel(
    payload_id: int,
    claimed_count: int,
    dispatcher: str | None = None,
) -> None:
    """
    Deliver messages from a mailbox in small parallel batches.

    Parallel delivery sacrifices strict ordering for increased throughput.
    Because of the sequential delivery in a mailbox we can't get higher throughput
    by scheduling batches in parallel.

    Messages will be delivered in small batches until a non-skippable failure
    occurs, the batch delay timeout is reached, or `claimed_count` records have
    been processed. Providers in
    `hybridcloud.webhookpayload.skip_on_failure_providers` (e.g. github) continue
    past retryable failures in the same way as sequential `drain_mailbox`.

    This drain holds no lock while it runs, so it must not deliver past the
    `claimed_count` records its dispatcher claimed — see `drain_mailbox`.

    `dispatcher` behaves as it does on `drain_mailbox`.
    """
    dispatch_tags = _dispatch_tags(dispatcher)
    try:
        payload = WebhookPayload.objects.get(id=payload_id)
    except WebhookPayload.DoesNotExist:
        # We could have hit a race condition. Since we've lost already return
        # and let the other process continue, or a future process.
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            # The row is gone, so nothing left in hand names the provider.
            tags={**dispatch_tags, "outcome": "race", "provider": UNKNOWN_PROVIDER},
        )
        logger.info("deliver_webhook_parallel.potential_race", extra={"id": payload_id})
        return

    _set_webhook_delivery_sentry_context(payload)

    skip_on_failure_providers = frozenset(
        options.get("hybridcloud.webhookpayload.skip_on_failure_providers") or ()
    )
    skip_on_failure = payload.provider in skip_on_failure_providers

    worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
    deleter = _deleter_for()
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    delivered = 0
    remaining = claimed_count
    current_id = payload.id
    extra = {**payload.as_dict(), "delivered": delivered}
    try:
        while True:
            if timezone.now() >= deadline:
                logger.info("deliver_webhook_parallel.delivery_deadline", extra=extra)
                metrics.incr(
                    "hybridcloud.deliver_webhooks.delivery",
                    tags={
                        **dispatch_tags,
                        "outcome": "delivery_deadline",
                        "provider": _provider_tag(payload),
                    },
                )
                break

            batch_size = min(worker_threads, remaining)
            attempted, delivered_batch, request_failed, next_id = _run_parallel_delivery_batch(
                payload.mailbox_name,
                current_id,
                batch_size,
                deleter,
                dispatch_tags=dispatch_tags,
            )
            delivered += delivered_batch
            extra["delivered"] = delivered

            if next_id is None:
                logger.info("deliver_webhook_parallel.task_complete", extra=extra)
                break

            # Advance past this batch so failed rows (left with a future
            # schedule_for) are not immediately re-attempted when we continue.
            current_id = next_id

            remaining -= attempted
            if remaining <= 0:
                # Claim exhausted. Rows past this point belong to whichever
                # dispatcher claims them next; delivering them here would race
                # a drain that dispatcher may have started.
                logger.debug("deliver_webhook_parallel.claim_exhausted", extra=extra)
                metrics.incr(
                    "hybridcloud.deliver_webhooks.delivery",
                    tags={**dispatch_tags, "outcome": "claim_exhausted"},
                )
                return

            if request_failed and not skip_on_failure:
                # For providers that require stricter mailbox behavior, stop on
                # the first batch that had a retryable failure.
                logger.info("deliver_webhook_parallel.delivery_request_failed", extra=extra)
                return
    finally:
        deleter.flush()


def deliver_message_parallel(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
    try:
        perform_request(payload)
        return (payload, None)
    except Exception as err:
        return (payload, err)


def deliver_message(
    payload: WebhookPayload, deleter: _PayloadDeleter, *, dispatch_tags: Mapping[str, str]
) -> bool:
    """
    Deliver a message if it still has delivery attempts remaining and is not stale.

    Returns whether the payload actually reached the cell. A payload that was
    discarded — attempts exhausted, too old, or permanently rejected — returns
    False even though it was removed from the mailbox.
    """
    payload_data = payload.as_dict()
    if payload.attempts >= MAX_ATTEMPTS:
        deleter.delete(payload)

        # Unsampled: see the parallel discard path above.
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={
                **dispatch_tags,
                "outcome": "attempts_exceed",
                "provider": _provider_tag(payload),
            },
            sample_rate=1.0,
        )
        logger.warning("deliver_webhook.discard", extra={**payload_data})
        return False

    if _discard_if_stale(payload, deleter, dispatch_tags=dispatch_tags):
        return False

    payload.schedule_next_attempt()
    try:
        perform_request(payload)
    except DeliveryDropped as err:
        # The cell rejected the payload permanently. Delete it like a delivery, but
        # don't record delivery time or count it as one — it never arrived.
        deleter.delete(payload)
        metrics.incr(
            "hybridcloud.deliver_webhooks.delivery",
            tags={**dispatch_tags, "outcome": err.outcome, "provider": _provider_tag(payload)},
        )
        return False
    date_added = payload.date_added
    deleter.delete(payload)
    _record_delivery_time_metrics(payload, dispatch_tags=dispatch_tags)
    if timezone.now() - date_added >= SLOW_DELIVERY_THRESHOLD:
        logger.warning("deliver_webhook.slow_delivery", extra=payload_data)
    metrics.incr(
        "hybridcloud.deliver_webhooks.delivery",
        tags={**dispatch_tags, "outcome": "ok", "provider": _provider_tag(payload)},
    )
    return True


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
                "provider": _provider_tag(payload),
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
                "provider": _provider_tag(payload),
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
                "provider": _provider_tag(payload),
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
                        "provider": _provider_tag(payload),
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
                "provider": _provider_tag(payload),
            },
        )
        logger.warning(
            "deliver_webhooks.api_error",
            extra={"error": str(err), "response_code": response_code, **payload.as_dict()},
        )
        raise DeliveryFailed() from err
