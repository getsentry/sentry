from typing import Any

from symbolic.proguard import ProguardMapper

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


def convert_android_methods_to_jvm_frames(methods: list[dict[str, Any]]) -> list[dict[str, Any]]:
    frames = []
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


def merge_jvm_frames_with_android_methods(
    frames: list[dict[str, Any]], methods: list[dict[str, Any]]
) -> None:
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
