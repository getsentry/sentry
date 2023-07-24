from typing import List, Tuple

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
def parse_obfuscated_signature(signature: str) -> Tuple[List[str], str]:
    signature = signature[1:]
    parameter_types, return_type = signature.rsplit(")", 1)
    types = []
    i = 0
    is_array = False

    while i < len(parameter_types):
        t = parameter_types[i]

        if t in JAVA_BASE_TYPES:
            start_index = i - int(is_array)
            types.append(parameter_types[start_index : i + 1])
            is_array = False
        elif t == "L":
            start_index = i - int(is_array)
            end_index = parameter_types[i:].index(";")
            types.append(parameter_types[start_index : i + end_index + 1])
            is_array = False
            i += end_index
        elif t == "[":
            is_array = True
        else:
            is_array = False

        i += 1

    return types, return_type


# format_signature formats the types into a human-readable signature
def format_signature(parameter_java_types: List[str], return_java_type: str) -> str:
    signature = f"({', '.join(parameter_java_types)})"
    if return_java_type != "void":
        signature += f": {return_java_type}"
    return signature


def byte_code_type_to_java_type(byte_code_type: str) -> str:
    token = byte_code_type[0]
    if token in JAVA_BASE_TYPES:
        return JAVA_BASE_TYPES[token]
    elif token == "L":
        return byte_code_type[1 : len(byte_code_type) - 1].replace("/", ".")
    elif token == "[":
        return f"{byte_code_type_to_java_type(byte_code_type[1:])}[]"
    else:
        return byte_code_type


# map_obfucated_signature will parse then deobfuscated a signature and
# format it appropriately
def map_obfuscated_signature(mapper, signature: str) -> str:
    parameter_types, return_type = parse_obfuscated_signature(signature)
    parameter_java_types = []

    for parameter_type in parameter_types:
        new_class = byte_code_type_to_java_type(parameter_type)
        mapped = mapper.remap_class(new_class)
        if mapped:
            new_class = mapped
        parameter_java_types.append(new_class)

    return_java_type = byte_code_type_to_java_type(return_type)
    mapped = mapper.remap_class(return_java_type)
    if mapped:
        return_java_type = mapped

    return format_signature(parameter_java_types, return_java_type)
