#!.venv/bin/python

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from enum import Enum, auto
from typing import Iterable

from sentry.utils import json

"""
Instructions for use:

1. Commit or stash any Git changes in progress.
2. Scroll down to "Fill these predicates in..." and write what you want to do.
3. From the Sentry project root, do
     ./scripts/silo/audit_silo_decorators.py | ./scripts/silo/add_silo_decorators.py
4. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""


class ClassCategory(Enum):
    MODEL = auto()
    ENDPOINT = auto()


@dataclass
class TargetClass:
    module: str
    name: str
    category: ClassCategory
    is_decorated: bool


def parse_audit(audit) -> Iterable[TargetClass]:
    def split_qualname(value):
        dot_index = value.rindex(".")
        module = value[:dot_index]
        name = value[dot_index + 1 :]
        return module, name

    def parse_group(category, dec_group):
        is_decorated = dec_group["decorator"] is not None
        for value in dec_group["values"]:
            module, name = split_qualname(value)
            yield TargetClass(module, name, category, is_decorated)

    for dec_group in audit["models"]["decorators"]:
        yield from parse_group(ClassCategory.MODEL, dec_group)
    for dec_group in audit["endpoints"]["decorators"]:
        yield from parse_group(ClassCategory.ENDPOINT, dec_group)


def read_audit():
    pipe_input = sys.stdin.read()
    brace_index = pipe_input.index("{")
    pipe_input = pipe_input[brace_index:]  # strip leading junk
    silo_audit = json.loads(pipe_input)
    return list(parse_audit(silo_audit))


def find_source_paths():
    for (dirpath, dirnames, filenames) in os.walk("./src/sentry"):
        for filename in filenames:
            if filename.endswith(".py"):
                yield os.path.join(dirpath, filename)


def find_class_declarations():
    for src_path in find_source_paths():
        with open(src_path) as f:
            src_code = f.read()
        for match in re.findall(r"\nclass\s+(\w+)\(", src_code):
            yield src_path, match


def insert_import(src_code: str, import_stmt: str) -> str:
    future_import = None
    for future_import in re.finditer(r"from\s+__future__\s+.*\n+", src_code):
        pass  # iterate to last match
    if future_import:
        start, end = future_import.span()
        return src_code[:end] + import_stmt + "\n" + src_code[end:]
    else:
        return import_stmt + "\n" + src_code


def apply_decorators(
    decorator_name: str,
    import_stmt: str,
    target_classes: Iterable[TargetClass],
) -> None:
    target_names = {c.name for c in target_classes if not c.is_decorated}
    for src_path, class_name in find_class_declarations():
        if class_name in target_names:
            with open(src_path) as f:
                src_code = f.read()
            new_code = re.sub(
                rf"\nclass\s+{class_name}\(",
                f"\n@{decorator_name}\nclass {class_name}(",
                src_code,
            )
            new_code = insert_import(new_code, import_stmt)
            with open(src_path, mode="w") as f:
                f.write(new_code)


def main():
    classes = read_audit()

    def filter_classes(category, predicate):
        return (c for c in classes if c.category == category and predicate(c))

    ####################################################################
    # Fill these predicates in with the logic you want to apply

    def control_model_predicate(c: TargetClass) -> bool:
        return False

    def customer_model_predicate(c: TargetClass) -> bool:
        return False

    def control_endpoint_predicate(c: TargetClass) -> bool:
        return False

    def customer_endpoint_predicate(c: TargetClass) -> bool:
        return False

    ####################################################################

    apply_decorators(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        filter_classes(ClassCategory.MODEL, control_model_predicate),
    )
    apply_decorators(
        "customer_silo_model",
        "from sentry.db.models import customer_silo_model",
        filter_classes(ClassCategory.MODEL, customer_model_predicate),
    )
    apply_decorators(
        "control_silo_endpoint",
        "from sentry.api.base import control_silo_endpoint",
        filter_classes(ClassCategory.ENDPOINT, control_endpoint_predicate),
    )
    apply_decorators(
        "customer_silo_endpoint",
        "from sentry.api.base import customer_silo_endpoint",
        filter_classes(ClassCategory.ENDPOINT, customer_endpoint_predicate),
    )


if __name__ == "__main__":
    main()
