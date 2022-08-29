#!.venv/bin/python

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from enum import Enum, auto
from typing import Callable, Iterable, Tuple

from sentry.utils import json

"""
Instructions for use:

1. Commit or stash any Git changes in progress.
2. Scroll down to "Fill these predicates in..." and write what you want to do.
3. From the Sentry project root, do
     ./scripts/servermode/audit_mode_limits.py | ./scripts/servermode/add_mode_limits.py
4. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""


class ClassCategory(Enum):
    MODEL = auto()
    VIEW = auto()


@dataclass
class LimitedClass:
    module: str
    name: str
    category: ClassCategory
    is_decorated: bool


def parse_audit(audit) -> Iterable[LimitedClass]:
    def split_qualname(value):
        dot_index = value.rindex(".")
        module = value[:dot_index]
        name = value[dot_index + 1 :]
        return module, name

    def parse_group(category, dec_group):
        is_decorated = dec_group["decorator"] is not None
        for value in dec_group["values"]:
            module, name = split_qualname(value)
            yield LimitedClass(module, name, category, is_decorated)

    for dec_group in audit["models"]["decorators"]:
        yield from parse_group(ClassCategory.MODEL, dec_group)
    for dec_group in audit["views"]["decorators"]:
        yield from parse_group(ClassCategory.VIEW, dec_group)


def read_audit():
    pipe_input = sys.stdin.read()
    brace_index = pipe_input.index("{")
    pipe_input = pipe_input[brace_index:]  # strip leading junk
    server_mode_audit = json.loads(pipe_input)
    return list(parse_audit(server_mode_audit))


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


def is_module(src_path: str, module_name: str) -> bool:
    if module_name is None:
        return False
    suffix = ".py"
    return src_path.endswith(suffix) and (
        src_path[: -len(suffix)].replace("/", ".").endswith(module_name)
    )


def apply_decorators(
    decorator_name: str,
    import_stmt: str,
    target_names: Iterable[Tuple[str, str]],
) -> None:
    targets = {class_name: module_name for (module_name, class_name) in target_names}
    for src_path, class_name in find_class_declarations():
        if is_module(src_path, targets.get(class_name)):
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

    def execute(
        decorator_name: str,
        import_stmt: str,
        category: ClassCategory,
        predicate: Callable[[LimitedClass], bool],
    ) -> None:
        filtered_targets = (
            (c.module, c.name)
            for c in classes
            if c.category == category and not c.is_decorated and predicate(c)
        )
        apply_decorators(decorator_name, import_stmt, filtered_targets)

    ####################################################################
    # Fill these predicates in with the logic you want to apply

    def control_model_predicate(c: LimitedClass) -> bool:
        return False

    def customer_model_predicate(c: LimitedClass) -> bool:
        return False

    def control_endpoint_predicate(c: LimitedClass) -> bool:
        return False

    def customer_endpoint_predicate(c: LimitedClass) -> bool:
        return False

    ####################################################################

    execute(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        ClassCategory.MODEL,
        control_model_predicate,
    )
    execute(
        "customer_silo_model",
        "from sentry.db.models import customer_silo_model",
        ClassCategory.MODEL,
        customer_model_predicate,
    )
    execute(
        "control_silo_endpoint",
        "from sentry.api.base import control_silo_endpoint",
        ClassCategory.VIEW,
        control_endpoint_predicate,
    )
    execute(
        "customer_silo_endpoint",
        "from sentry.api.base import customer_silo_endpoint",
        ClassCategory.VIEW,
        customer_endpoint_predicate,
    )


if __name__ == "__main__":
    main()
