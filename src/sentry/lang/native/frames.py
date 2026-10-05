import posixpath

from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import ParseDebugIdError

from sentry.lang.native.utils import is_native_platform
from sentry.stacktraces.functions import trim_function_name
from sentry.utils.safe import get_path, trim


def merge_frame(new_frame, symbolicated, platform="native"):
    # il2cpp events which have the "csharp" platform have good (C#) names
    # coming from the SDK, we do not want to override those with bad (mangled) C++ names.
    if platform != "csharp" and symbolicated.get("function"):
        raw_func = trim(symbolicated["function"], 256)
        func = trim(trim_function_name(symbolicated["function"], platform), 256)

        # if function and raw function match, we can get away without
        # storing a raw function
        if func == raw_func:
            new_frame["function"] = raw_func
        # otherwise we store both
        else:
            new_frame["raw_function"] = raw_func
            new_frame["function"] = func
    if symbolicated.get("instruction_addr"):
        new_frame["instruction_addr"] = symbolicated["instruction_addr"]
    if symbolicated.get("function_id"):
        new_frame["function_id"] = symbolicated["function_id"]
    if symbolicated.get("symbol"):
        new_frame["symbol"] = symbolicated["symbol"]
    if symbolicated.get("abs_path"):
        new_frame["abs_path"] = symbolicated["abs_path"]
        new_frame["filename"] = posixpath.basename(symbolicated["abs_path"])
    if symbolicated.get("filename"):
        new_frame["filename"] = symbolicated["filename"]
    if symbolicated.get("lineno"):
        new_frame["lineno"] = symbolicated["lineno"]
    if symbolicated.get("colno"):
        new_frame["colno"] = symbolicated["colno"]
    # similarly as with `function` above, we do want to retain the original "package".
    if platform != "csharp" and symbolicated.get("package"):
        new_frame["package"] = symbolicated["package"]
    if symbolicated.get("trust"):
        new_frame["trust"] = symbolicated["trust"]
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line") is not None:
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]
    if symbolicated.get("source_link"):
        new_frame["source_link"] = symbolicated["source_link"]
    if symbolicated.get("vars"):
        new_frame["vars"] = symbolicated["vars"]

    addr_mode = symbolicated.get("addr_mode")
    if addr_mode is None:
        new_frame.pop("addr_mode", None)
    else:
        new_frame["addr_mode"] = addr_mode

    if symbolicated.get("status"):
        frame_meta = new_frame.setdefault("data", {})
        frame_meta["symbolicator_status"] = symbolicated["status"]


def handles_frame(data, frame):
    if not frame:
        return False

    if get_path(frame, "data", "symbolicator_status") is not None:
        return False

    # TODO: Consider ignoring platform
    platform = frame.get("platform") or data.get("platform")
    return is_native_platform(platform) and frame.get("instruction_addr") is not None


def get_frames_for_symbolication(
    frames,
    data,
    modules,
    adjustment=None,
):
    modules_by_debug_id = None
    rv = []
    adjustment = adjustment or "auto"

    for frame in reversed(frames):
        if not handles_frame(data, frame):
            continue
        s_frame = dict(frame)

        if adjustment == "none":
            s_frame["adjust_instruction_addr"] = False

        # validate and expand addressing modes.  If we can't validate and
        # expand it, we keep None which is absolute.  That's not great but
        # at least won't do damage.
        addr_mode = s_frame.pop("addr_mode", None)
        sanitized_addr_mode = None

        # None and abs mean absolute addressing explicitly.
        if addr_mode in (None, "abs"):
            pass
        # this is relative addressing to module by index or debug id.
        elif addr_mode.startswith("rel:"):
            arg = addr_mode[4:]
            idx = None

            if modules_by_debug_id is None:
                modules_by_debug_id = {x.get("debug_id"): idx for idx, x in enumerate(modules)}
            try:
                idx = modules_by_debug_id.get(normalize_debug_id(arg))
            except ParseDebugIdError:
                pass

            if idx is None and arg.isdigit():
                idx = int(arg)

            if idx is not None:
                sanitized_addr_mode = "rel:%d" % idx

        if sanitized_addr_mode is not None:
            s_frame["addr_mode"] = sanitized_addr_mode
        rv.append(s_frame)

    if len(rv) > 0:
        first_frame = rv[0]
        if adjustment == "all":
            first_frame["adjust_instruction_addr"] = True
        elif adjustment == "all_but_first":
            first_frame["adjust_instruction_addr"] = False

    return rv
