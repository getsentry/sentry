from collections import Counter
from collections.abc import Mapping
from dataclasses import replace
from datetime import datetime, timedelta

import pytest

from sentry.anomaly_detection.checkpoint.codec import _restore, _snapshot
from sentry.anomaly_detection.contracts import (
    ChangeAction,
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Service,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation.correlator import Correlator, episode_key
from sentry.anomaly_detection.correlation.footprint import (
    FOOTPRINT_DEFERRED,
    CallEdge,
    Footprint,
    FootprintResult,
    SliceStats,
    service_of,
    slice_of,
)
from sentry.anomaly_detection.correlation.shared_dependencies import (
    DependencySlice,
    SharedConfig,
    learn,
)
from sentry.anomaly_detection.evaluation.organization import OrgEvaluator

START = datetime(2024, 1, 1)
MINUTE = timedelta(minutes=1)
LATENCY = Metric.P95_DURATION
CHECKOUT = SeriesKey(1, "production", Signal.ENDPOINTS, LATENCY, "/checkout")
ORDERS = SeriesKey(2, "production", Signal.OUTBOUND_DB, LATENCY, "orders")


def _episode(
    key: SeriesKey, start: datetime = START, change_type: ChangeType = ChangeType.SLOWDOWN
) -> ChangeEvent:
    return ChangeEvent(key, change_type, start, 100, 10, 0.9, open_ratio=10, peak_ratio=10)


class _Traces:
    def __init__(self, footprints: Mapping[SeriesKey, FootprintResult]) -> None:
        self.footprints = footprints
        self.calls: list[tuple[SeriesKey, datetime]] = []

    def footprint(self, event: ChangeEvent, observation_end: datetime) -> FootprintResult:
        self.calls.append((event.key, observation_end))
        return self.footprints.get(event.key)


def _checkout_footprint(target: SeriesKey = ORDERS, share: float = 0.8) -> Footprint:
    return Footprint(
        CHECKOUT,
        ["trace-1", "trace-2"],
        slices={slice_of(target): SliceStats(share, 100, 2)},
        edges=Counter(
            {CallEdge(service_of(CHECKOUT), "orders.example.com", service_of(target)): 2}
        ),
    )


@pytest.mark.parametrize(
    ("primary", "alias"),
    [
        (
            SeriesKey(1, "production", Signal.ERRORS, Metric.COUNT),
            SeriesKey(1, "production", Signal.ERRORS, Metric.COUNT_UNIQUE_USER),
        ),
        (
            SeriesKey(1, "production", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST),
            SeriesKey(1, "production", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST),
        ),
        (CHECKOUT, replace(CHECKOUT, metric=Metric.FAILURE_RATE)),
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
    assert opened.group.blast_radius == [Service(1, "production"), Service(2, "production")]
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
    totals = SeriesKey(2, "production", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint(totals)}))
    events: list[ChangeAction] = [
        ("open", _episode(CHECKOUT)),
        ("open", _episode(totals, change_type=ChangeType.SPIKE)),
    ]
    actions = correlator.step(START, events)

    assert len([action for action in actions if action.kind == "open"]) == 2


@pytest.mark.parametrize("latent_first", [True, False], ids=["latent-first", "open-first"])
def test_routine_downstream_change_supports_localization_without_independent_evidence(
    latent_first: bool,
) -> None:
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint()}))
    checkout, orders = _episode(CHECKOUT), _episode(ORDERS)
    latent: ChangeAction = ("latent", orders)
    opened: ChangeAction = ("open", checkout)
    first, second = (latent, opened) if latent_first else (opened, latent)
    correlator.step(START, [first])
    actions = correlator.step(START + MINUTE, [second])

    assert len(correlator.groups) == 1
    assert actions[0].root is orders
    assert actions[0].group.change_events == [checkout, orders]
    assert all(action.independent_count == 1 for action in actions)

    promoted = correlator.step(START + 2 * MINUTE, [("open", orders)])
    assert promoted
    assert all(action.independent_count == 2 for action in promoted)


@pytest.mark.parametrize(
    ("orders_escalations", "expected_action", "group_count"),
    [
        pytest.param([], "open", 2, id="only-checkout-started-recently"),
        pytest.param([(START + 45 * MINUTE, 20)], "join", 1, id="orders-also-worsened"),
    ],
)
def test_new_failure_mode_requires_nearby_change_in_its_own_service(
    orders_escalations: list[tuple[datetime, float]], expected_action: str, group_count: int
) -> None:
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint()}))
    orders = _episode(ORDERS)
    checkout = _episode(CHECKOUT, START + 40 * MINUTE)
    failure = _episode(
        SeriesKey(ORDERS.project_id, ORDERS.env, Signal.NEW_ISSUE, Metric.COUNT, "ORDERS-1"),
        START + 46 * MINUTE,
        ChangeType.NEW_FAILURE_MODE,
    )
    correlator.step(orders.start, [("open", orders)])
    assert correlator.step(checkout.start, [("open", checkout)])[0].kind == "join"

    orders.escalations = orders_escalations
    actions = correlator.step(failure.start, [("open", failure)])

    assert actions[0].kind == expected_action
    assert len(correlator.groups) == group_count


def test_latent_escalation_sets_urgency_when_opening_without_a_group() -> None:
    rate = SeriesKey(1, "production", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)
    event = _episode(rate, change_type=ChangeType.SPIKE)
    correlator = Correlator()
    assert not correlator.step(START, [("latent", event)])
    event.novelty = {"opened_on_escalation": True}

    actions = correlator.step(START + MINUTE, [("open", event)])

    assert actions[0].kind == "open"
    assert actions[0].group.urgency == Urgency.HIGH


def test_common_cause_merges_groups_and_remaps_members() -> None:
    cart = SeriesKey(3, "production", Signal.ENDPOINTS, LATENCY, "/cart")
    checkout, cart_event, orders = _episode(CHECKOUT), _episode(cart), _episode(ORDERS)
    cart_footprint = Footprint(
        cart,
        ["cart-trace"],
        slices={slice_of(ORDERS): SliceStats(1, 100, 1)},
        edges=Counter({CallEdge(service_of(cart), "orders.example.com", service_of(ORDERS)): 1}),
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


def test_merge_carries_sustained_urgency_after_recovery() -> None:
    dependency_key = replace(ORDERS, project_id=CHECKOUT.project_id)
    correlator = Correlator(_Traces({CHECKOUT: _checkout_footprint(dependency_key)}))
    checkout = _episode(CHECKOUT)
    (opened,) = correlator.step(START, [("open", checkout)])
    checkout.sustained_at = START + 30 * MINUTE
    correlator.step(checkout.sustained_at, [])
    assert opened.group.urgency == Urgency.MEDIUM
    checkout.ended_at = START + 31 * MINUTE
    correlator.step(checkout.ended_at, [("close", checkout)])

    dependency = _episode(dependency_key, START + 34 * MINUTE)
    (dependency_opened,) = correlator.step(dependency.start, [("open", dependency)])
    assert dependency_opened.group.urgency == Urgency.LOW
    restarted = _episode(CHECKOUT, START + 36 * MINUTE)
    actions = correlator.step(restarted.start, [("open", restarted)])

    (closed,) = [action for action in actions if action.kind == "close"]
    assert closed.group is opened.group
    assert closed.merged_into == dependency_opened.group.id
    (survivor,) = correlator.groups
    assert survivor.group is dependency_opened.group
    assert survivor.group.urgency == Urgency.MEDIUM


@pytest.mark.parametrize(
    ("second_issue_id", "expected_action", "group_count"),
    [(123, "join", 1), (456, "open", 2)],
)
def test_same_issue_matches_structured_identity_not_display_evidence(
    second_issue_id: int, expected_action: str, group_count: int
) -> None:
    first = _episode(CHECKOUT)
    second = _episode(replace(CHECKOUT, env="staging"), START + MINUTE)
    first.issue_ids = (123,)
    second.issue_ids = (second_issue_id,)
    first.evidence = second.evidence = ["issues:999"]
    correlator = Correlator()
    (opened,) = correlator.step(first.start, [("open", first)])

    actions = correlator.step(second.start, [("open", second)])

    assert actions[0].kind == expected_action
    assert len(correlator.groups) == group_count
    assert opened.group.driving_issues == [123]


def test_deferred_footprint_is_retried_after_checkpoint_restore() -> None:
    checkout = _episode(CHECKOUT)
    unrelated = _episode(
        SeriesKey(3, "production", Signal.ENDPOINTS, LATENCY, "/help"), START + MINUTE
    )
    traces = _Traces({CHECKOUT: FOOTPRINT_DEFERRED})
    projects = (CHECKOUT.project_id, ORDERS.project_id, unrelated.key.project_id)
    evaluator = OrgEvaluator(traces, projects=projects)
    (opened,) = evaluator.corr.step(checkout.start, [("open", checkout)])
    evaluator.corr.step(unrelated.start, [("open", unrelated)])
    assert (CHECKOUT, unrelated.start + MINUTE) in traces.calls

    orders = _episode(ORDERS, START + 2 * MINUTE)
    next_traces = _Traces({CHECKOUT: _checkout_footprint()})
    restored = _restore(next_traces, _snapshot(evaluator, orders.start), projects=projects)
    actions = restored.corr.step(orders.start, [("open", orders)])

    assert (CHECKOUT, orders.start + MINUTE) in next_traces.calls
    assert all(key != unrelated.key for key, _ in next_traces.calls)
    assert actions[0].kind == "join"
    assert actions[0].group.id == opened.group.id
    assert actions[0].root is orders


def test_shared_dependency_learning_links_repeated_co_onsets_without_traces() -> None:
    replica = SeriesKey(3, "production", Signal.OUTBOUND_DB, LATENCY, "orders")
    varied_onsets = [START + timedelta(hours=i * 9, minutes=i * 7) for i in range(6)]
    history = {
        ORDERS: [_episode(ORDERS, onset) for onset in varied_onsets],
        replica: [_episode(replica, onset + MINUTE) for onset in varied_onsets],
    }
    now = START + timedelta(days=3)
    observed_hours = {START + timedelta(hours=i): (1 << 60) - 1 for i in range(72)}
    coverage = {key: observed_hours for key in history}
    correlator = Correlator()
    correlator.shared = learn(history, now, coverage=coverage)
    actions = correlator.step(
        now, [("open", _episode(ORDERS, now)), ("open", _episode(replica, now))]
    )

    assert len(correlator.groups) == 1
    assert all(action.independent_count == 1 for action in actions)
    localization = actions[-1].group.localization
    assert localization is not None and "shared with" in localization
    assert learn(history, START, coverage=coverage).get(ORDERS, replica) is None


@pytest.mark.parametrize("latent_first", [True, False])
def test_shared_latent_bridges_groups_without_joining_namesake(latent_first: bool) -> None:
    replica = replace(ORDERS, project_id=3)
    support_key = replace(ORDERS, project_id=4)
    namesake = replace(ORDERS, project_id=5)
    support_slice = DependencySlice(
        service_of(support_key), support_key.signal, support_key.dim_value
    )
    config = SharedConfig(
        force=[
            (support_slice, DependencySlice(service_of(key), key.signal, key.dim_value))
            for key in (ORDERS, replica)
        ]
    )
    correlator = Correlator()
    support = _episode(support_key)
    first, second, unrelated = (_episode(key) for key in (ORDERS, replica, namesake))
    correlator.step(START, [("open", unrelated), ("open", first)])
    if latent_first:
        # The latent excursion can predate the availability of learned evidence.
        correlator.step(START, [("latent", support)])
    correlator.shared = learn({}, START, config, coverage={})
    actions = correlator.step(START + MINUTE, [("open", second)])
    if not latent_first:
        assert len(correlator.state.open_groups) == 3
        actions = correlator.step(START + 2 * MINUTE, [("latent", support)])

    owner = correlator.by_event[episode_key(support)]
    assert len(correlator.state.open_groups) == 2
    assert set(owner.members) == {episode_key(event) for event in (first, second, support)}
    assert owner.members[episode_key(support)].latent
    assert correlator.independent(owner) == 1
    assert episode_key(support) not in correlator.state.latent
    assert any(
        action.kind == "close" and action.merged_into == owner.group.id for action in actions
    )


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
