from typing import Any

from symbolic.proguard import ProguardMapper

from sentry.profiles.utils import Profile, is_android_trace_format, is_jvm_frame

JAVA_BASE_TYPES = {
    "Z": "boolean",
    "B": "byte",
    "C": "char",
    "S": "short",
    "I": "int",
    "J": "long",
    "F": "float",
    "D": "double",
    "V": "void",
}


# parse_obfuscated_signature will parse an obfuscated signatures into parameter
# and return types that can be then deobfuscated
def parse_obfuscated_signature(signature: str) -> tuple[list[str], str]:
    if signature[0] != "(":
        return [], ""

    signature = signature[1:]
    try:
        parameter_types, return_type = signature.rsplit(")", 1)
    except ValueError:
        # the lack of `)` indicates a malformed signature
        return [], ""
    types = []
    i = 0
    arrays = 0

    while i < len(parameter_types):
        t = parameter_types[i]

        if t in JAVA_BASE_TYPES:
            start_index = i - arrays
            types.append(parameter_types[start_index : i + 1])
            arrays = 0
        elif t == "L":
            start_index = i - arrays
            try:
                end_index = parameter_types.index(";", i)
            except ValueError:
                # the lack of `;` indicates a malformed signature
                return [], ""
            types.append(parameter_types[start_index : end_index + 1])
            arrays = 0
            i = end_index
        elif t == "[":
            arrays += 1
        else:
            arrays = 0

        i += 1

    return types, return_type


# format_signature formats the types into a human-readable signature
def format_signature(types: tuple[list[str], str] | None) -> str:
    if types is None:
        return ""
    parameter_java_types, return_java_type = types
    signature = f"({', '.join(parameter_java_types)})"
    if return_java_type and return_java_type != "void":
        signature += f": {return_java_type}"
    return signature


def byte_code_type_to_java_type(byte_code_type: str, mapper: ProguardMapper | None = None) -> str:
    if not byte_code_type:
        return ""

    token = byte_code_type[0]
    if token in JAVA_BASE_TYPES:
        return JAVA_BASE_TYPES[token]
    elif token == "L":
        # invalid signature
        if byte_code_type[-1] != ";":
            return byte_code_type
        obfuscated = byte_code_type[1:-1].replace("/", ".")
        if mapper:
            mapped = mapper.remap_class(obfuscated)
            if mapped:
                return mapped
        return obfuscated
    elif token == "[":
        return f"{byte_code_type_to_java_type(byte_code_type[1:], mapper)}[]"
    else:
        return byte_code_type


# deobfuscate_signature will parse and deobfuscate a signature
# returns a tuple where the first element is the list of the function
# parameters and the second one is the return type
def deobfuscate_signature(
    signature: str, mapper: ProguardMapper | None = None
) -> tuple[list[str], str] | None:
    if not signature:
        return None

    parameter_types, return_type = parse_obfuscated_signature(signature)
    if not (parameter_types or return_type):
        return None

    parameter_java_types = []
    for parameter_type in parameter_types:
        new_class = byte_code_type_to_java_type(parameter_type, mapper)
        parameter_java_types.append(new_class)

    return_java_type = byte_code_type_to_java_type(return_type, mapper)
    return parameter_java_types, return_java_type


def convert_android_methods_to_jvm_frames(profile: Profile) -> list[dict[str, Any]]:
    frames = []

    if is_android_trace_format(profile):
        methods = profile["profile"]["methods"]
        for i, m in enumerate(methods):
            f = {
                "function": m["name"],
                "index": i,
                "module": m["class_name"],
            }
            if "signature" in m:
                f["signature"] = m["signature"]
            if "source_line" in m:
                f["lineno"] = m["source_line"]
            if "source_file" in m:
                f["filename"] = m["source_file"]
            frames.append(f)
        return frames
    else:
        # sample v2: JVM frames live in profile["profile"]["frames"] and are
        # identified via is_jvm_frame. `index` records each JVM frame's position
        # in the original frames list so the results can be merged back.
        for i, f in enumerate(profile["profile"]["frames"]):
            if not is_jvm_frame(f, profile):
                continue
            # function and module are optional on sample format frames; keep
            # frames missing one of them so the other still gets deobfuscated
            jvm_frame = {
                "function": f.get("function", ""),
                "index": i,
                "module": f.get("module", ""),
            }
            if "signature" in f:
                jvm_frame["signature"] = f["signature"]
            if "lineno" in f:
                jvm_frame["lineno"] = f["lineno"]
            if "filename" in f:
                jvm_frame["filename"] = f["filename"]
            frames.append(jvm_frame)
        return frames


def _merge_jvm_frame_and_android_method(f: dict[str, Any], m: dict[str, Any]) -> None:
    m["class_name"] = f["module"]
    m["data"] = {"deobfuscation_status": "deobfuscated"}
    m["name"] = f["function"]
    if "signature" in f:
        m["signature"] = f["signature"]
    if "filename" in f:
        m["source_file"] = f["filename"]
    if "lineno" in f and f["lineno"] != 0:
        m["source_line"] = f["lineno"]
    if "in_app" in f:
        m["in_app"] = f["in_app"]


def _apply_jvm_frame_to_sample_v2_frame(f: dict[str, Any], frame: dict[str, Any]) -> None:
    frame["module"] = f["module"]
    frame["function"] = f["function"]
    frame["data"] = {"deobfuscation_status": "deobfuscated"}
    if "signature" in f:
        frame["signature"] = f["signature"]
    if "filename" in f:
        frame["filename"] = f["filename"]
    if "lineno" in f and f["lineno"] != 0:
        frame["lineno"] = f["lineno"]
    if "in_app" in f:
        frame["in_app"] = f["in_app"]


def merge_jvm_frames_with_android_methods(frames: list[dict[str, Any]], profile: Profile) -> None:
    if is_android_trace_format(profile):
        methods = profile["profile"]["methods"]
        for f in frames:
            m = methods[f["index"]]
            # Update the method if it's the first time we see it.
            if m.get("data", {}).get("deobfuscation_status", "") != "deobfuscated":
                _merge_jvm_frame_and_android_method(f, m)
            # Otherwise, it's an additional method returned, we add it to the inline frames.
            else:
                # We copy the frame triggering the inline ones so we only have to
                # look at this field later one to construct a stack trace.
                if "inline_frames" not in m:
                    m["inline_frames"] = [m.copy()]
                im: dict[str, Any] = {}
                _merge_jvm_frame_and_android_method(f, im)
                m["inline_frames"].append(im)
    else:
        _merge_jvm_frames_with_sample_v2(frames, profile)


def _merge_jvm_frames_with_sample_v2(jvm_frames: list[dict[str, Any]], profile: Profile) -> None:
    # Symbolicator may return several frames for a single input frame (inlines).
    # Sample v2 has no per-frame `inline_frames`; inlining is expressed by
    # expanding the frame list and remapping the stacks that reference it.
    deobf_by_index: dict[int, list[dict[str, Any]]] = {}
    for f in jvm_frames:
        deobf_by_index.setdefault(f["index"], []).append(f)

    original_frames = profile["profile"]["frames"]
    new_frames: list[dict[str, Any]] = []
    # original frame index -> list of indices in the rebuilt frame list
    index_map: dict[int, list[int]] = {}
    for old_index, frame in enumerate(original_frames):
        deobf = deobf_by_index.get(old_index)
        if not deobf:
            index_map[old_index] = [len(new_frames)]
            new_frames.append(frame)
            continue
        new_indices = []
        for jvm_frame in deobf:
            merged = dict(frame)
            _apply_jvm_frame_to_sample_v2_frame(jvm_frame, merged)
            new_indices.append(len(new_frames))
            new_frames.append(merged)
        index_map[old_index] = new_indices

    profile["profile"]["stacks"] = [
        [new_index for old_index in stack for new_index in index_map.get(old_index, [old_index])]
        for stack in profile["profile"]["stacks"]
    ]
    profile["profile"]["frames"] = new_frames
