from django.template.defaultfilters import pluralize


def format_duration_idiomatic(minutes: int) -> str:
    """
    Format minutes into an idiomatic duration string for the purpose of these alerts.

    For usage like
    "in the past 5 minutes"
    "in the past hour"
    "in the past day"
    "in the past 14 minutes"
    "in the past 2 hours"
    "in the past 2 hours and 14 minutes"
    "in the past 2 days and 4 hours"
    "in the past week"
    "in the past 9 days"
    "in the past month"
    """

    literal = ""
    unit = ""
    limits = {"month": 30 * 24 * 60, "week": 7 * 24 * 60, "day": 24 * 60, "hour": 60, "minute": 1}

    for unit, limit in limits.items():
        if minutes >= limit:
            value = int(minutes // limit)
            literal = f"{value:d}" if value != 1 else ""
            unit_str = f" {unit}{pluralize(value)}"
            return f"{literal}{unit_str}".strip()
    return f"{minutes} minutes"
