from __future__ import annotations

from sentry import options


def get_sample_rate_override_for_project(project_id: int) -> float | None:
    """
    Return a per-project sample rate override for custom dynamic sampling, if one is
    configured via the ``dynamic-sampling.sample-rate-override-per-project`` option.

    The option maps a stringified project id to a fixed sample rate that hard-replaces
    whatever rate the custom dynamic sampling path would otherwise compute. Returns
    ``None`` when no override applies (no entry, or an out-of-range/invalid value, which
    we ignore rather than emit an invalid rule).
    """
    overrides = options.get("dynamic-sampling.sample-rate-override-per-project")
    raw = overrides.get(str(project_id))
    if raw is None:
        return None

    try:
        rate = float(raw)
    except (TypeError, ValueError):
        return None

    if 0.0 <= rate <= 1.0:
        return rate
    return None
