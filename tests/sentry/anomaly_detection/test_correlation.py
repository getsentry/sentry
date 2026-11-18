from collections import Counter
from collections.abc import Mapping
from datetime import datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlate import Correlator, episode_key
from sentry.anomaly_detection.footprint import Footprint, SliceStats, service_of, slice_of
from sentry.anomaly_detection.shared import learn

START = datetime(2024, 1, 1)
MINUTE = timedelta(minutes=1)
LATENCY = "p95(span.duration)"
CHECKOUT = SeriesKey("1", "production", "endpoints", LATENCY, "/checkout")
ORDERS = SeriesKey("2", "production", "outbound_db", LATENCY, "orders")


def _episode(
    key: SeriesKey, start: datetime = START, change_type: ChangeType = ChangeType.SLOWDOWN
) -> ChangeEvent:
    return ChangeEvent(key, change_type, start, 100, 10, 0.9, open_ratio=10, peak_ratio=10)


class _Traces:
    def __init__(self, footprints: Mapping[SeriesKey, Footprint]) -> None:
        self.footprints = footprints

    def footprint(self, event: ChangeEvent) -> Footprint | None:
        return self.footprints.get(event.key)


def _checkout_footprint(target: SeriesKey = ORDERS, share: float = 0.8) -> Footprint:
    return Footprint(
        CHECKOUT,
        ["trace-1", "trace-2"],
        slices={slice_of(target): SliceStats(share, 100, 2)},
        edges=Counter({(service_of(CHECKOUT), "orders.example.com", service_of(target)): 2}),
    )


@pytest.mark.parametrize(
    ("primary", "alias"),
    [
        (
            SeriesKey("1", "production", "errors", "count()"),
            SeriesKey("1", "production", "errors", "count_unique(user)"),
        ),
        (
            SeriesKey("1", "production", "error_rate", "errors/requests"),
            SeriesKey("1", "production", "failed_rate", "failed_requests/requests"),
        ),
        (
            CHECKOUT,
            SeriesKey("1", "production", "endpoints_slow", "slow_rate(>100ms)", "/checkout"),
        ),
    ],
)
def test_signal_aliases_are_one_piece_of_evidence(primary: SeriesKey, alias: SeriesKey) -> None:
    first, second = _episode(primary), _episode(alias, START + MINUTE)
    correlator = Correlator()
    opened = correlator.step(START + 2 * MINUTE, [("open", first)])
    joined = correlator.step(START + 3 * MINUTE, [("open", second)])

    assert len(correlator.groups) == 1
    assert opened[0].group is joined[0].group
    assert joined[0].group.change_events == [first, second]
    assert {action.independent_count for action in joined} == {1}


def test_timing_alone_does_not_group_projects() -> None:
    correlator = Correlator()
    actions = correlator.step(START, [("open", _episode(CHECKOUT)), ("open", _episode(ORDERS))])

    opened = [action.group for action in actions if action.kind == "open"]
    assert len(opened) == 2
    assert opened[0].possibly_related == [opened[1].id]
    assert opened[1].possibly_related == [opened[0].id]


def test_trace_link_localizes_downstream_and_closes_after_all_changes_end() -> None:
    checkout, orders = _episode(CHECKOUT), _episode(ORDERS, START + MINUTE)
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint()}))
    opened = correlator.step(START + 2 * MINUTE, [("open", checkout)])[0]
    joined = correlator.step(START + 3 * MINUTE, [("open", orders)])

    assert len(correlator.groups) == 1
    assert all(action.independent_count == 2 for action in joined)
    assert joined[0].group is opened.group
    assert joined[0].root is orders
    assert opened.group.localization == "2/production database orders"
    assert opened.group.blast_radius == ["1/production", "2/production"]
    assert opened.group.urgency == Urgency.MEDIUM

    checkout.ended_at = START + 5 * MINUTE
    orders.ended_at = START + 30 * MINUTE
    assert not correlator.step(checkout.ended_at, [("close", checkout)])
    assert not correlator.step(START + 25 * MINUTE, [])
    assert not correlator.step(orders.ended_at, [("expire", orders)])
    assert not correlator.step(START + 44 * MINUTE, [])
    closed = correlator.step(START + 45 * MINUTE, [])
    assert [(action.kind, action.group.id) for action in closed] == [("close", opened.group.id)]
    assert not correlator.step(START + 46 * MINUTE, [])


def test_generic_service_trace_touch_is_not_a_cross_project_link() -> None:
    totals = SeriesKey("2", "production", "error_rate", "errors/requests")
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint(totals)}))
    events = [
        ("open", _episode(CHECKOUT)),
        ("open", _episode(totals, change_type=ChangeType.SPIKE)),
    ]
    actions = correlator.step(START, events)

    assert len([action for action in actions if action.kind == "open"]) == 2


def test_routine_downstream_change_supports_localization_without_independent_evidence() -> None:
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint()}))
    checkout, orders = _episode(CHECKOUT), _episode(ORDERS)
    assert correlator.step(START, [("latent", orders)]) == []
    actions = correlator.step(START + MINUTE, [("open", checkout)])

    assert len(correlator.groups) == 1
    assert actions[0].root is orders
    assert actions[0].group.change_events == [checkout, orders]
    assert all(action.independent_count == 1 for action in actions)

    promoted = correlator.step(START + 2 * MINUTE, [("open", orders)])
    assert promoted
    assert all(action.independent_count == 2 for action in promoted)


def test_common_cause_merges_groups_and_remaps_members() -> None:
    cart = SeriesKey("3", "production", "endpoints", LATENCY, "/cart")
    checkout, cart_event, orders = _episode(CHECKOUT), _episode(cart), _episode(ORDERS)
    cart_footprint = Footprint(
        cart,
        ["cart-trace"],
        slices={slice_of(ORDERS): SliceStats(1, 100, 1)},
        edges=Counter({(service_of(cart), "orders.example.com", service_of(ORDERS)): 1}),
    )
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint(), cart: cart_footprint}))
    correlator.step(START + MINUTE, [("open", checkout), ("open", cart_event)])
    merged = correlator.step(START + 2 * MINUTE, [("open", orders)])

    assert len(correlator.groups) == 1
    survivor = correlator.by_event[episode_key(orders)]
    assert correlator.by_event[episode_key(checkout)] is survivor
    assert correlator.by_event[episode_key(cart_event)] is survivor
    assert survivor.root is orders
    assert survivor.group.possibly_related == []
    (closed,) = [action for action in merged if action.kind == "close"]
    assert closed.merged_into == survivor.group.id
    assert closed.independent_count == 1
    assert correlator.independent(survivor) == 3


def test_shared_dependency_learning_links_repeated_co_onsets_without_traces() -> None:
    replica = SeriesKey("3", "production", "outbound_db", LATENCY, "orders")
    varied_onsets = [START + timedelta(hours=i * 9, minutes=i * 7) for i in range(6)]
    history = {
        ORDERS: [_episode(ORDERS, onset) for onset in varied_onsets],
        replica: [_episode(replica, onset + MINUTE) for onset in varied_onsets],
    }
    now = START + timedelta(days=3)
    correlator = Correlator()
    correlator.shared = learn(history, now)
    actions = correlator.step(
        now, [("open", _episode(ORDERS, now)), ("open", _episode(replica, now))]
    )

    assert len(correlator.groups) == 1
    assert all(action.independent_count == 1 for action in actions)
    localization = actions[-1].group.localization
    assert localization is not None and "shared with" in localization
    assert learn(history, START).get(ORDERS, replica) is None


def test_late_downstream_change_cannot_explain_earlier_onset() -> None:
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint()}))
    correlator.step(START, [("open", _episode(CHECKOUT))])
    late = START + 40 * MINUTE
    actions = correlator.step(late, [("open", _episode(ORDERS, late))])

    assert len(correlator.groups) == 2
    assert actions[0].kind == "open"


def test_pruning_keeps_a_closed_group_needed_by_an_absorbed_restart() -> None:
    correlator = Correlator()
    original = _episode(ORDERS)
    (opened,) = correlator.step(START, [("open", original)])
    original.ended_at = START + 10 * MINUTE
    correlator.step(original.ended_at, [("close", original)])
    restarted = _episode(ORDERS, START + 15 * MINUTE)
    correlator.step(restarted.start, [("latent", restarted)])
    (closed,) = correlator.step(START + 25 * MINUTE, [])
    assert closed.kind == "close"

    later = START + 80 * MINUTE
    correlator.prune(later)
    actions = correlator.step(later, [("open", restarted)])

    assert len(correlator.groups) == 1
    assert actions[0].kind == "reopen"
    assert actions[0].group.id == opened.group.id
    assert actions[0].independent_count == 1
