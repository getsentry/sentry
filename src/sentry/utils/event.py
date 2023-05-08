from sentry.utils.safe import get_path


# Check if an event contains a minified stack trace (source maps for javascript)
def has_event_minified_stack_trace(event):
    exception_values = get_path(event.data, "exception", "values", filter=True)

    if exception_values:
        for exception_value in exception_values:
            if "stacktrace" in exception_value and "raw_stacktrace" in exception_value:
                return True

    return False


def is_event_from_browser_javascript_sdk(event):
    sdk_name = get_path(event, "sdk", "name")
    if sdk_name is None:
        return False

    return sdk_name.lower() in [
        "sentry.javascript.browser",
        "sentry.javascript.react",
        "sentry.javascript.gatsby",
        "sentry.javascript.ember",
        "sentry.javascript.vue",
        "sentry.javascript.angular",
        "sentry.javascript.angular-ivy",
        "sentry.javascript.nextjs",
        "sentry.javascript.electron",
        "sentry.javascript.remix",
        "sentry.javascript.svelte",
        "sentry.javascript.sveltekit",
    ]
