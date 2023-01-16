from sentry.utils.safe import get_path


# Check if an event contains a minified stack trace (source maps for javascript)
def has_event_minified_stack_trace(event):
    exception_values = get_path(event.data, "exception", "values", filter=True)

    if exception_values:
        for exception_value in exception_values:
            if "stacktrace" in exception_value and "raw_stacktrace" in exception_value:
                return True

    return False
