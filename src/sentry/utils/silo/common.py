from __future__ import annotations

import os
import re
from dataclasses import dataclass
from enum import Enum, auto
from typing import Iterable, Mapping, Tuple


class ClassCategory(Enum):
    MODEL = auto()
    ENDPOINT = auto()


def apply_decorators(
    decorator_name: str,
    import_stmt: str,
    target_names: Iterable[Tuple[str, str]],
    path_name: str,
) -> None:
    def find_source_paths():
        for (dirpath, dirnames, filenames) in os.walk(path_name):
            for filename in filenames:
                if filename.endswith(".py"):
                    yield os.path.join(dirpath, filename)

    def find_class_declarations():
        for src_path in find_source_paths():
            with open(src_path) as f:
                src_code = f.read()
            for match in re.findall(r"\nclass\s+(\w+)\(", src_code):
                yield src_path, match

    def insert_import(src_code: str) -> str:
        future_import = None
        for future_import in re.finditer(r"from\s+__future__\s+.*\n+", src_code):
            pass  # iterate to last match
        if future_import:
            start, end = future_import.span()
            return src_code[:end] + import_stmt + "\n" + src_code[end:]
        else:
            return import_stmt + "\n" + src_code

    def is_module(src_path: str, module_name: str | None) -> bool:
        if module_name is None:
            return False
        suffix = ".py"
        return src_path.endswith(suffix) and (
            src_path[: -len(suffix)].replace("/", ".").endswith(module_name)
        )

    targets = {class_name: module_name for (module_name, class_name) in target_names}
    for src_path, class_name in find_class_declarations():
        if is_module(src_path, targets.get(class_name)):
            with open(src_path) as f:
                src_code = f.read()
            new_code = re.sub(
                rf"\nclass\s+{class_name}\(",
                rf"\n@{decorator_name}\g<0>",
                src_code,
            )
            new_code = insert_import(new_code)
            with open(src_path, mode="w") as f:
                f.write(new_code)


@dataclass
class Keywords:
    include_words: Iterable[str]
    exclude_words: Iterable[str] = ()


def has_customer_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    customer_keywords = keywords.get("customer")
    return any(re.search(word, name) for word in customer_keywords.include_words) and not any(
        re.search(word, name) for word in customer_keywords.exclude_words
    )


def has_control_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    if has_customer_name(name, keywords):
        return False

    control_keywords = keywords.get("control")
    return any(re.search(word, name) for word in control_keywords.include_words) and not any(
        re.search(word, name) for word in control_keywords.exclude_words
    )
