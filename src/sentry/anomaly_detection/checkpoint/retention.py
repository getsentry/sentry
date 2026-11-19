"""Bound retained evaluator state and reconcile changes to enabled projects."""

from collections import defaultdict, deque
from collections.abc import Set as AbstractSet
from dataclasses import replace
from datetime import datetime, timedelta

from sentry.anomaly_detection.contracts import (
    AnomalyGroupKey,
    ChangeAction,
    ChangeType,
    EpisodeKey,
    Metric,
    SeriesKey,
    Service,
    Signal,
)
from sentry.anomaly_detection.correlation.correlator import (
    Correlator,
    GroupState,
    _localize,
    episode_key,
)
from sentry.anomaly_detection.correlation.footprint import service_of
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import (
    _CONTEXT_HORIZON,
    AnomalyDecision,
    OrgEvaluator,
)
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftState
from sentry.anomaly_detection.evaluation.series_history import RULES, SeriesState
from sentry.anomaly_detection.inputs.measurements import MAX_ENVIRONMENTS, MAX_SLICES
from sentry.utils import metrics

# Budget two full collector cohorts per project/signal, counting active groups
# against the same limit. History size then depends on the retained measurement
# windows, not on how often dimensions change or how well values compress.
_RETAINED_SLICE_GROUPS = 2 * MAX_ENVIRONMENTS * MAX_SLICES
# Errors and spans discover environments independently.
_RETAINED_ENVIRONMENTS = 2 * 2 * MAX_ENVIRONMENTS
# Keep more cohorts for learning than for the minute-level detector. The recent
# excursion cap is well above the recurrence rates the novelty model distinguishes.
_NOVELTY_COHORTS = 4
_NOVELTY_RECORDS_PER_SERIES = 64


def _prune_for_snapshot(evaluator: OrgEvaluator, cursor: datetime) -> None:
    _prune_group_members(evaluator.corr, cursor)
    _prune_novelty(evaluator, cursor)


def _history_floor(evaluator: OrgEvaluator, cursor: datetime) -> datetime:
    baseline_cfg = evaluator.baseline.cfg
    # Include the 60m baseline plus its reach-back for excluded minutes. A new
    # episode refits at its first persistence hit, up to one rule window earlier.
    # Already-open episodes carry their frozen reference level and sigma.
    anchor_lookback = max(rule.persist[1] for rule in RULES) - 1
    return cursor - timedelta(
        minutes=baseline_cfg.window_min + baseline_cfg.reach_back_min + anchor_lookback
    )


def _trim_group_metadata(group: GroupState) -> None:
    services = {service_of(key.series_key) for key in group.members}
    issues = {issue for member in group.members.values() for issue in member.event.issue_ids}
    blast_radius = group.group.blast_radius
    # Localization can name peers that are no longer represented. Fall back to
    # the retained root without relocalizing (which may query trace evidence).
    if any(service not in services for service in blast_radius):
        group.group.localization = _localize(group.root.key)
    blast_radius[:] = [service for service in blast_radius if service in services]
    group.group.driving_issues[:] = [
        issue for issue in group.group.driving_issues if issue in issues
    ]


def _prune_group_members(corr: Correlator, cursor: datetime) -> None:
    # A continuous group can contain arbitrarily many completed episodes. Keep
    # its root, ongoing members and the same recent context used for late issues.
    floor = cursor - _CONTEXT_HORIZON
    for group in corr.groups:
        root_key = episode_key(group.root)
        expired = {
            key
            for key, member in group.members.items()
            if key != root_key and member.closed_at is not None and member.closed_at < floor
        }
        if not expired:
            continue

        # Retained members must not point to a representative that no longer
        # exists. Preserve the alias classes even if the old parent is expired.
        aliases: dict[EpisodeKey, list[EpisodeKey]] = defaultdict(list)
        for key, member in group.members.items():
            if key not in expired:
                aliases[corr._representative(group, member)].append(key)
        for members in aliases.values():
            representative = min(members)
            for key in members:
                group.members[key].representative = (
                    None if key == representative else representative
                )

        for key in expired:
            del group.members[key]
            if corr.by_event.get(key) is group:
                del corr.by_event[key]
        group.group.change_events[:] = [
            event for event in group.group.change_events if episode_key(event) not in expired
        ]
        _trim_group_metadata(group)


def _prune_novelty(evaluator: OrgEvaluator, cursor: datetime) -> None:
    novelty = evaluator.novelty
    novelty.prune(cursor)
    cohorts: dict[tuple[int, Signal, Metric, bool], list[tuple[datetime, SeriesKey]]] = defaultdict(
        list
    )
    for key in novelty.coverage.keys() | novelty.history.keys():
        hours = novelty.coverage.get(key, {})
        latest_observation = datetime.min
        if hours:
            latest_hour = max(hours)
            latest_observation = latest_hour + (hours[latest_hour].bit_length() - 1) * MINUTE
        latest_excursion = max(
            (record.start for record in novelty.history.get(key, ())), default=datetime.min
        )
        cohorts[key.project_id, key.signal, key.metric, bool(key.dim_value)].append(
            (max(latest_observation, latest_excursion), key)
        )
    retained = evaluator.series_history.watched.keys() | evaluator.rate_shifts.state.keys()
    for (_, _, _, sliced), candidates in cohorts.items():
        limit = _NOVELTY_COHORTS * MAX_ENVIRONMENTS * (MAX_SLICES if sliced else 2)
        retained.update(key for _, key in sorted(candidates, reverse=True)[:limit])
    for key in novelty.coverage.keys() - retained:
        del novelty.coverage[key]
    for key in novelty.history.keys() - retained:
        del novelty.history[key]
    for records in novelty.history.values():
        if len(records) > _NOVELTY_RECORDS_PER_SERIES:
            del records[:-_NOVELTY_RECORDS_PER_SERIES]


def _reconcile_correlation(
    evaluator: OrgEvaluator, projects: AbstractSet[int], boundary: datetime
) -> list[AnomalyDecision]:
    corr = evaluator.corr
    state = corr.state

    def service_in_scope(service: Service) -> bool:
        return service.project_id in projects

    retired: set[AnomalyGroupKey] = set()
    discarded_open: set[AnomalyGroupKey] = set()
    for groups in (state.open_groups, state.closed_groups):
        for group_id, group in list(groups.items()):
            previous = evaluator.qualified.get(group_id)
            if (
                (previous is not None and previous.project_id not in projects)
                or group.root.key.project_id not in projects
                or any(key.series_key.project_id not in projects for key in group.members)
            ):
                retired.add(group_id)
                if group.closed_at is None:
                    discarded_open.add(group_id)
                del groups[group_id]
                for key, member in group.members.items():
                    if corr.by_event.get(key) is not group:
                        continue
                    del corr.by_event[key]
                    # Keep ongoing changes as support only. Reopening one as a
                    # standalone finding could recreate the retired group's ID.
                    if (
                        group.closed_at is None
                        and member.closed_at is None
                        and member.event.ended_at is None
                        and member.event.change_type != ChangeType.NEW_FAILURE_MODE
                        and key.series_key.project_id in projects
                    ):
                        state.latent[key] = member.event
                        evaluator.absorbed.pop(key, None)
                        evaluator.next_look.pop(key, None)
            else:
                _trim_group_metadata(group)
                for member in group.members.values():
                    if (footprint := member.footprint) is not None:
                        for part in list(footprint.slices):
                            if not service_in_scope(part.service):
                                del footprint.slices[part]
                        for edge in list(footprint.edges):
                            if not service_in_scope(edge.caller) or not service_in_scope(
                                edge.callee
                            ):
                                del footprint.edges[edge]

    for group in corr.groups:
        group.group.possibly_related[:] = [
            key for key in group.group.possibly_related if key not in retired
        ]
    closes = []
    for group_id, decision in list(evaluator.qualified.items()):
        owner_enabled = decision.project_id in projects
        if group_id in discarded_open and owner_enabled and not decision.is_resolved:
            # The current root may differ from the published owner. Close the
            # original lifecycle at the scope boundary, never migrate it.
            closes.append(replace(decision, timestamp=boundary, is_resolved=True))
        if group_id in retired or not owner_enabled:
            del evaluator.qualified[group_id]
    for edges in (state.edges, state.edge_seen_at):
        for edge in list(edges):
            if not service_in_scope(edge.caller) or not service_in_scope(edge.callee):
                del edges[edge]
    for pair_key, pair in list(state.shared.pairs.items()):
        if not service_in_scope(pair.a.service) or not service_in_scope(pair.b.service):
            del state.shared.pairs[pair_key]
    return closes


def _reconcile_projects(
    evaluator: OrgEvaluator, projects: AbstractSet[int], boundary: datetime
) -> list[AnomalyDecision]:
    detector, cp, novelty = evaluator.series_history, evaluator.rate_shifts, evaluator.novelty
    for mapping in (
        evaluator.series,
        evaluator.hourly,
        detector.watched,
        detector.state,
        cp.exclude,
        cp.state,
        cp.spike_minutes,
        cp._spike_seen,
        novelty.coverage,
        novelty.history,
    ):
        for key in list(mapping):
            if key.project_id not in projects:
                del mapping[key]
    cp.watched[:] = [key for key in cp.watched if key.project_id in projects]
    detector.exclude = {
        key: reason for key, reason in detector.exclude.items() if key.project_id in projects
    }
    for key, hour in list(detector._pseudo):
        if key.project_id not in projects:
            del detector._pseudo[key, hour]

    for episodes in (evaluator.absorbed, evaluator.next_look, evaluator.corr.state.latent):
        for episode in list(episodes):
            if episode.series_key.project_id not in projects:
                del episodes[episode]
    for service in list(evaluator.harm):
        if service.project_id not in projects:
            del evaluator.harm[service]
    evaluator.pending_issues[:] = [
        e for e in evaluator.pending_issues if e.key.project_id in projects
    ]
    evaluator.known_issues[:] = [e for e in evaluator.known_issues if e.key.project_id in projects]
    evaluator.point_closes[:] = [
        (ts, e) for ts, e in evaluator.point_closes if e.key.project_id in projects
    ]
    return _reconcile_correlation(evaluator, projects, boundary)


def _evict_stale_series(
    evaluator: OrgEvaluator, cursor: datetime, at: datetime
) -> list[AnomalyDecision]:
    floor = _history_floor(evaluator, cursor)
    det, cp = evaluator.series_history, evaluator.rate_shifts
    opened = {
        key for states in (det.state, cp.state) for key, state in states.items() if state.open
    }
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
        scope: set(
            sorted(groups, key=lambda group: (groups[group], group), reverse=True)[
                :_RETAINED_SLICE_GROUPS
            ]
        )
        for scope, groups in slices.items()
    }
    kept_envs = {
        project: set(
            sorted(envs, key=lambda env: (envs[env], env), reverse=True)[:_RETAINED_ENVIRONMENTS]
        )
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
    expirations: list[ChangeAction] = []
    maps = (
        evaluator.series,
        det.watched,
        det.state,
        cp.exclude,
        cp.state,
        cp.spike_minutes,
        cp._spike_seen,
    )
    for key in sorted(evicted | expired):
        for states in (det.state, cp.state):
            state = states.get(key)
            if state is None or state.open is None:
                continue
            event = state.open
            event.ended_at = at
            if key in expired:
                event.evidence.append("expired: measurements no longer collected")
            else:
                event.evidence.append("expired: active episode exceeded checkpoint cohort budget")
                over_cap += 1
            expirations.append(("expire", event))
        if key not in evicted:
            # Another metric still needs this slice or environment. Reset the
            # expired detector without forgetting the retained measurements.
            if (series_state := det.state.get(key)) is not None and series_state.open is not None:
                det.state[key] = SeriesState(recent=deque(maxlen=series_state.recent.maxlen))
            if (rate_state := cp.state.get(key)) is not None and rate_state.open is not None:
                cp.state[key] = RateShiftState()
            continue
        for mapping in maps:
            mapping.pop(key, None)
    cp.watched[:] = [key for key in cp.watched if key not in evicted]
    det.exclude = {key: reason for key, reason in det.exclude.items() if key not in evicted}
    for pseudo_key in list(det._pseudo):
        if pseudo_key[0] in evicted:
            del det._pseudo[pseudo_key]
    if over_cap:
        metrics.incr("anomaly_detection.active_episode_evicted", amount=over_cap)

    # Retain novelty and existing correlation context on their own horizons.
    # Unlike a recovery, expiration does not imply an observed return to normal.
    if expirations:
        return evaluator._decisions(evaluator.corr.step(at, evaluator._judge(at, expirations)))
    return []
