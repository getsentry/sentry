from sentry import features, options
from sentry.models.organization import Organization


def is_night_shift_enabled(organization: Organization) -> bool:
    return options.get("seer.night_shift.enable") and features.has(
        "organizations:seer-night-shift", organization
    )
