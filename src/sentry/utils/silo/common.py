from __future__ import annotations

import os
import re
from dataclasses import dataclass
from enum import Enum, auto
from typing import Iterable, Mapping, Sequence, Tuple


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

    @classmethod
    def _parse_words(cls, name: str) -> Sequence[str]:
        return tuple(re.findall(".[a-z]*", name))

    @classmethod
    def _contains(cls, name: str, target: str) -> bool:
        name_words = cls._parse_words(name)
        target_words = cls._parse_words(target)
        return all(word in name_words for word in target_words)

    def check(self, name: str) -> bool:
        has_included_word = any(self._contains(name, keyword) for keyword in self.include_words)
        has_excluded_word = any(self._contains(name, keyword) for keyword in self.exclude_words)
        return has_included_word and not has_excluded_word


def has_customer_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    return keywords["customer"].check(name)


def has_control_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    return (not has_customer_name(name, keywords)) and keywords["control"].check(name)
