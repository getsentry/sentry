from __future__ import annotations

from sentry import options


def get_sample_rate_overrides() -> dict[int, float]:
    """
    Return the validated per-project sample rate overrides for custom dynamic sampling,
    as configured via the ``dynamic-sampling.sample-rate-override-per-project`` option.

    The option maps a stringified project id to a fixed sample rate that hard-replaces
    whatever rate the custom dynamic sampling path would otherwise compute. Entries with
    an invalid id or an out-of-range/invalid rate are skipped (rather than emitting an
    invalid rule). Reads the option once so callers iterating over many projects don't
    re-read it per project.
    """
    overrides: dict[int, float] = {}
    for raw_id, raw_rate in options.get(
        "dynamic-sampling.sample-rate-override-per-project"
    ).items():
        try:
            project_id = int(raw_id)
            rate = float(raw_rate)
        except (TypeError, ValueError):
            continue
        if 0.0 <= rate <= 1.0:
            overrides[project_id] = rate
    return overrides


def get_sample_rate_override_for_project(project_id: int) -> float | None:
    """Return the sample rate override for a single project, or ``None`` if none applies."""
    return get_sample_rate_overrides().get(project_id)
