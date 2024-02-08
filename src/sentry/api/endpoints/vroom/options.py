import sentry.options

# List of options to return.
VROOM_OPTIONS: list[str] = ["profiling.profile_metrics.unsampled_profiles.sample_rate"]


def get_vroom_options():
    """Return the options for Vroom."""

    options = dict()
    for option in VROOM_OPTIONS:
        if (value := sentry.options.get(option)) is not None:
            options[option] = value

    return options
