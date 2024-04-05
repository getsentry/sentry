import re

from sentry_sdk.hub import Hub
from sentry_sdk.integrations import Integration
from sentry_sdk.scope import add_global_event_processor

from sentry.utils.safe import get_path

SYSTEM_FRAMES = [
    "std::",
    "core::",
    "alloc::",
    "backtrace::",
    "failure::",
    # these are not modules but things like __rust_maybe_catch_panic
    "__rust_",
    "___rust_",
]

OUTER_BORDER_FRAMES = ["_ffi_call", "ffi_call"]

INNER_BORDER_FRAMES = [
    "std::panicking::begin_panic",
    "core::panicking::panic",
    "failure::error_message::err_msg",
    "failure::backtrace::Backtrace::new",
    "failure::backtrace::internal::InternalBacktrace::new",
    "failure::Fail::context",
]

FRAME_RE = re.compile(
    r"""(?xm)
    ^
        (?!stacktrace\:[\ ]stack[\ ]backtrace\:)

        [\ ]*                             # leading whitespace
        (?:\d+:[\ ]*)?                    # leading frame number

        (?P<addr>0x[a-f0-9]+)?            # instruction address (osx)
        ([\ ]?-[\ ])?                     # dash (osx), can happen without addr if inline frame

        (?P<symbol>[^\r\n]+?)

        ([\ ]?\(
            (?P<addr_linux>0x[a-f0-9]+)   # instruction address (linux)
        \))?

        (?:
            \r?\n
            [\ \t]+at[\ ]
            (?P<path>[^\r\n]+?)
            (?::(?P<lineno>\d+))?
        )?
    $
"""
)

HASH_FUNC_RE = re.compile(
    r"""(?x)
    ^(.*)::h[a-f0-9]{16}$
"""
)

PATTERN_MATCH_RE = re.compile(r"^(_?\<|\w+ as )+")

RUST_CRATE_RE = re.compile(r"([a-zA-Z0-9_]+?)(?:\.\.|::)")

RUST_ESCAPES_RE = re.compile(
    r"""(?x)
    \$
        (SP|BP|RF|LT|GT|LP|RP|C|
            u7e|u20|u27|u5b|u5d|u7b|u7d|u3b|u2b|u22)
    \$
"""
)

RUST_ESCAPES = {
    "SP": "@",
    "BP": "*",
    "RF": "&",
    "LT": "<",
    "GT": ">",
    "LP": "(",
    "RP": ")",
    "C": ",",
    "u7e": "~",
    "u20": " ",
    "u27": "'",
    "u5b": "[",
    "u5d": "]",
    "u7b": "{",
    "u7d": "}",
    "u3b": ";",
    "u2b": "+",
    "u22": '"',
}


def get_filename(abs_path):
    """Returns the basename of the given absolute path."""
    return abs_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]


def strip_symbol(symbol):
    """Strips rust function hashes of the given symbol."""
    if symbol:
        match = HASH_FUNC_RE.match(symbol)
        if match:
            return match.group(1)

    return symbol


def demangle_rust(symbol):
    """Demangles common escapes in the given rust symbol."""
    return RUST_ESCAPES_RE.sub(lambda m: RUST_ESCAPES.get(m.group(1), ""), symbol)


def starts_with(function, pattern):
    """
    Returns whether the given function name matches the pattern.
    This takes trait implementation and name mangling into account.
    """
    return PATTERN_MATCH_RE.sub("", function).replace(".", ":").startswith(pattern)


def matches_frame(function, patterns):
    """Returns whether the given function name matches any of the patterns."""
    return any(starts_with(function, p) for p in patterns)


def frame_from_match(match, last_addr):
    """Creates a sentry stack frame from a backtrace entry."""
    symbol = strip_symbol(match.group("symbol"))
    function = demangle_rust(symbol)

    frame = {
        "function": function,
        "in_app": not matches_frame(function, SYSTEM_FRAMES),
        "instruction_addr": match.group("addr") or match.group("addr_linux") or last_addr,
    }

    if symbol != function:
        frame["symbol"] = symbol

    package = RUST_CRATE_RE.search(function)
    if package and package.group(1):
        frame["package"] = package.group(1)

    path = match.group("path")
    if path:
        frame["abs_path"] = path
        frame["filename"] = get_filename(path)

    lineno = match.group("lineno")
    if lineno:
        lineno = int(lineno)
    if lineno:
        frame["lineno"] = lineno

    return frame


def frames_from_rust_info(rust_info):
    """
    Extracts a list of frames from the given rust_info string.

    Border frames from the python interpreter, FFI calls, panic unwinding and
    backtrace generation are trimmed off.
    """
    frames = []
    last_addr = None
    for m in FRAME_RE.finditer(rust_info):
        frame = frame_from_match(m, last_addr)
        last_addr = frame["instruction_addr"]
        frames.append(frame)

    end = next(
        (i for i, f in enumerate(frames) if matches_frame(f["function"], OUTER_BORDER_FRAMES)),
        len(frames),
    )

    start = -next(
        (
            i
            for i, f in enumerate(reversed(frames))
            if matches_frame(f["function"], INNER_BORDER_FRAMES)
        ),
        0,
    )

    return frames[start:end]


def strip_backtrace_message(target, field):
    """
    Strips the backtrace off a message, if it contains one.
    """
    if target and isinstance(target.get(field), str):
        target[field] = target[field].split("\n\nstacktrace:", 1)[0].strip()


def merge_rust_info_frames(event, hint):
    """
    Adds rust exception backtraces to the python traceback.

    If there is no rust_info attribute on the exception or the event has no
    exception, this operation is a noop. Otherwise, it parses the rust backtrace
    and adds it on top of existing python frames.

    This changes the event's platform to "native" and patches existing frames.
    Additionally, the traceback is removed from the exception value and logentry
    interfaces.
    """
    if "exc_info" not in hint:
        return event

    exc_type, exc_value, tb = hint["exc_info"]
    if not hasattr(exc_value, "rust_info") or not exc_value.rust_info:
        return event

    exception = get_path(event, "exception", "values", 0)
    stacktrace = get_path(exception, "stacktrace", "frames")
    if not stacktrace:
        return event

    # Update the platform
    event["platform"] = "native"
    for frame in stacktrace:
        frame["platform"] = "python"

    # Remove rust_info from messages
    strip_backtrace_message(exception, "value")
    strip_backtrace_message(event.get("logentry"), "message")
    strip_backtrace_message(event.get("logentry"), "formatted")

    # Extend the stacktrace
    frames = frames_from_rust_info(exc_value.rust_info)
    if frames:
        stacktrace.extend(reversed(frames))

    return event


class RustInfoIntegration(Integration):
    identifier = "rust_info"

    @staticmethod
    def setup_once():
        @add_global_event_processor
        def processor(event, hint):
            integration = Hub.current.get_integration(RustInfoIntegration)
            if integration is None:
                return event

            return merge_rust_info_frames(event, hint)
