import re

from sentry.utils.safe import get_path


def deobfuscate_exception_value(data):
    # Deobfuscate the exception value by regex replacing
    # Mapping constructed by taking the last lines from the deobfuscated stacktrace and raw stacktrace
    exception = get_path(data, "exception", "values", -1)
    frame = get_path(exception, "stacktrace", "frames", -1)
    raw_frame = get_path(exception, "raw_stacktrace", "frames", -1)
    if frame and raw_frame:
        deobfuscated_method_name = f"{frame['module']}.{frame['function']}"
        raw_method_name = f"{raw_frame['module']}.{raw_frame['function']}"
        exception["value"] = re.sub(
            re.escape(raw_method_name), deobfuscated_method_name, exception["value"]
        )

    return data
