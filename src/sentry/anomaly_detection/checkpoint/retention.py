"""Bound the evaluator state carried between runs.

Policy only: each component forgets, expires and prunes its own state.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from sentry.anomaly_detection.contracts import Metric, SeriesKey, Signal
from sentry.anomaly_detection.evaluation.organization import (
    CONTEXT_HORIZON,
    AnomalyDecision,
    OrgEvaluator,
)
from sentry.anomaly_detection.evaluation.series_history import RULES
from sentry.anomaly_detection.inputs.measurements import MAX_ENVIRONMENTS, MAX_SLICES
from sentry.utils import metrics

# Budget two full collector cohorts per project/signal, counting active groups
# against the same limit. History size then depends on the retained measurement
# windows, not on how often dimensions change or how well values compress.
_RETAINED_SLICE_GROUPS = 2 * MAX_ENVIRONMENTS * MAX_SLICES
# Errors and spans discover environments independently.
_ENVIRONMENT_SOURCES = 2
_RETAINED_ENVIRONMENTS = 2 * _ENVIRONMENT_SOURCES * MAX_ENVIRONMENTS
# Keep more cohorts for learning than for the minute-level detector. The recent
# excursion cap is well above the recurrence rates the novelty model distinguishes.
_NOVELTY_COHORTS = 4
_NOVELTY_RECORDS_PER_SERIES = 64


def history_floor(evaluator: OrgEvaluator, cursor: datetime) -> datetime:
    """The first minute of measurements a resumed evaluator needs."""
    baseline_cfg = evaluator.baseline.cfg
    # Include the 60m baseline plus its reach-back for excluded minutes. A new
    # episode refits at its first persistence hit, up to one rule window earlier.
    # Already-open episodes carry their frozen reference level and sigma.
    anchor_lookback = max(rule.persist[1] for rule in RULES) - 1
    return cursor - timedelta(
        minutes=baseline_cfg.window_min + baseline_cfg.reach_back_min + anchor_lookback
    )


def bound_context(evaluator: OrgEvaluator, cursor: datetime) -> None:
    """Drop old group members and novelty history beyond the retained cohorts."""
    evaluator.corr.prune_members(cursor - CONTEXT_HORIZON)
    novelty = evaluator.novelty
    novelty.prune(cursor)
    cohorts: dict[tuple[int, Signal, Metric, bool], list[tuple[datetime, SeriesKey]]] = defaultdict(
        list
    )
    for key in novelty.keys():
        cohort = key.project_id, key.signal, key.metric, bool(key.dim_value)
        cohorts[cohort].append((novelty.last_seen(key), key))
    retained = evaluator.series_history.state.watched.keys() | evaluator.rate_shifts.state.keys()
    for (_, _, _, sliced), candidates in cohorts.items():
        per_environment = MAX_SLICES if sliced else _ENVIRONMENT_SOURCES
        limit = _NOVELTY_COHORTS * MAX_ENVIRONMENTS * per_environment
        retained.update(key for _, key in sorted(candidates, reverse=True)[:limit])
    novelty.forget(novelty.keys() - retained)
    novelty.cap_history(_NOVELTY_RECORDS_PER_SERIES)


def evict_stale_series(
    evaluator: OrgEvaluator, cursor: datetime, at: datetime
) -> list[AnomalyDecision]:
    """Forget slices and environments beyond the retained cohorts and expire episodes on
    series that are no longer collected."""
    floor = history_floor(evaluator, cursor)
    history, rate_shifts = evaluator.series_history, evaluator.rate_shifts
    opened = history.open_keys() | rate_shifts.open_keys()
    live: dict[SeriesKey, datetime] = {}
    for key in opened:
        points = evaluator.series.get(key, {})
        for minute in reversed(points):
            if minute < floor:
                break
            if points[minute] is not None:
                live[key] = minute
                break

    slices: dict[tuple[int, Signal], dict[tuple[str, str], tuple[bool, datetime]]] = defaultdict(
        dict
    )
    environments: dict[int, dict[str, tuple[bool, datetime]]] = defaultdict(dict)
    for key, points in evaluator.series.items():
        seen = next(reversed(points), datetime.min)
        priority = (key in live, live.get(key, seen))
        if key.dim_value:
            if seen >= floor:
                group = key.env, key.dim_value
                members = slices[key.project_id, key.signal]
                members[group] = max(priority, members.get(group, priority))
        else:
            envs = environments[key.project_id]
            envs[key.env] = max(priority, envs.get(key.env, priority))

    # Live episodes take their metric group with them, not extra slots. If they
    # alone exceed the budget, prefer the last observed episodes, with stable ties.
    kept_slices = {
        scope: _highest_ranked(groups, _RETAINED_SLICE_GROUPS) for scope, groups in slices.items()
    }
    kept_envs = {
        project: _highest_ranked(envs, _RETAINED_ENVIRONMENTS)
        for project, envs in environments.items()
    }
    evicted: set[SeriesKey] = set()
    for key in evaluator.series:
        if key.dim_value:
            if (key.env, key.dim_value) not in kept_slices.get((key.project_id, key.signal), ()):
                evicted.add(key)
        elif key.env not in kept_envs[key.project_id]:
            # Empty aggregate keys preserve the presence of request instrumentation
            # for this environment, but environments themselves are bounded.
            evicted.add(key)
    expired = opened - live.keys()
    if not (evicted or expired):
        return []

    over_cap = 0
    expirations = []
    for key in sorted(evicted | expired):
        reason = (
            "expired: measurements no longer collected"
            if key in expired
            else "expired: active episode exceeded checkpoint cohort budget"
        )
        for tracker in (history, rate_shifts):
            if (event := tracker.expire(key, at, reason)) is not None:
                expirations.append(event)
                over_cap += key not in expired
    # Another metric may still need an expired series' slice or environment, so only
    # evicted series lose their measurements.
    evaluator.forget_series(evicted)
    if over_cap:
        metrics.incr("anomaly_detection.active_episode_evicted", amount=over_cap)
    # Retain novelty and existing correlation context on their own horizons.
    # Unlike a recovery, expiration does not imply an observed return to normal.
    return evaluator.expire(at, expirations) if expirations else []


def _highest_ranked[T](ranks: dict[T, tuple[bool, datetime]], limit: int) -> set[T]:
    """The `limit` highest-ranked members, breaking rank ties by member."""
    return set(sorted(ranks, key=lambda member: (ranks[member], member), reverse=True)[:limit])
