from __future__ import annotations

import os
import re
from collections import defaultdict
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
        """Find the target class declarations.

        For each module-class pair in `target_names`, check the Python source file
        corresponding to that module. If the named class is declared in that module,
        yield it.
        """
        targets = defaultdict(set)
        for (module_name, class_name) in target_names:
            targets[class_name].add(module_name)

        for src_path in find_source_paths():
            with open(src_path) as f:
                src_code = f.read()
            for class_name in re.findall(r"\nclass\s+(\w+)\(", src_code):
                for module_name in targets[class_name]:
                    if is_module(src_path, module_name):
                        yield src_path, class_name

    def is_module(src_path: str, module_name: str) -> bool:
        """Check whether a source file path is for the correct module."""
        suffix = ".py"
        return src_path.endswith(suffix) and (
            src_path[: -len(suffix)].replace("/", ".").endswith(module_name)
        )

    def insert_import(src_code: str) -> str:
        future_import = None
        for future_import in re.finditer(r"from\s+__future__\s+.*\n+", src_code):
            pass  # iterate to last match
        if future_import:
            start, end = future_import.span()
            return src_code[:end] + import_stmt + "\n" + src_code[end:]
        else:
            return import_stmt + "\n" + src_code

    for src_path, class_name in find_class_declarations():
        with open(src_path) as f:
            src_code = f.read()
        decorator_is_new = False

        def replace(match):
            nonlocal decorator_is_new

            existing_decorator, class_decl = match.groups()
            if existing_decorator == decorator_name:
                return match.group()
            decorator_is_new = True
            return f"\n@{decorator_name}\n{class_decl}"

        # Try to detect a pre-existing decorator, if possible, and replace it if it
        # doesn't match the decorator we are trying to add. This works only if the
        # decorator is immediately above the class, which is usually a safe
        # assumption because that's where this script writes it. In the long run,
        # it could be disrupted by the insertion of a comment, another unrelated
        # decorator, or such.
        new_code = re.sub(
            (
                r"(?:\n@((?:control|region|all|pending)_silo_(?:model|endpoint|test)))?"
                rf"\n(class\s+{class_name}\()"
            ),
            replace,
            src_code,
        )

        if decorator_is_new:
            # Naively insert a new import statement. This may add duplicate import
            # statements if we decorate more than one class in the same file,
            # or leave behind an old import statement if we are replacing an existing
            # decorator. Rely on pre-commit hooks or IDE tools to clean it up.
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


def has_region_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    return keywords["region"].check(name)


def has_control_name(name: str, keywords: Mapping[str, Keywords]) -> bool:
    return (not has_region_name(name, keywords)) and keywords["control"].check(name)
