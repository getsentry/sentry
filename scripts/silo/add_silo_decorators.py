#!/usr/bin/env sentry exec

from __future__ import annotations

import sys
from dataclasses import dataclass
from enum import Enum, auto
from typing import Callable, Iterable

from scripts.silo.common import apply_decorators, has_control_name, has_customer_name
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


def main():
    classes = read_audit()

    def execute(
        decorator_name: str,
        import_stmt: str,
        category: ClassCategory,
        predicate: Callable[[TargetClass], bool],
    ) -> None:
        filtered_targets = (
            (c.module, c.name)
            for c in classes
            if c.category == category and not c.is_decorated and predicate(c)
        )
        apply_decorators(decorator_name, import_stmt, filtered_targets)

    ####################################################################
    # Fill these predicates in with the logic you want to apply

    def customer_model_predicate(c: TargetClass) -> bool:
        return False  # For now, rely on decorate_models_by_relation instead

    def control_model_predicate(c: TargetClass) -> bool:
        return False  # For now, rely on decorate_models_by_relation instead

    def customer_endpoint_predicate(c: TargetClass) -> bool:
        return has_customer_name(c.name)

    def control_endpoint_predicate(c: TargetClass) -> bool:
        return has_control_name(c.name)

    ####################################################################

    execute(
        "customer_silo_model",
        "from sentry.db.models import customer_silo_model",
        ClassCategory.MODEL,
        customer_model_predicate,
    )
    execute(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        ClassCategory.MODEL,
        control_model_predicate,
    )
    execute(
        "customer_silo_endpoint",
        "from sentry.api.base import customer_silo_endpoint",
        ClassCategory.ENDPOINT,
        customer_endpoint_predicate,
    )
    execute(
        "control_silo_endpoint",
        "from sentry.api.base import control_silo_endpoint",
        ClassCategory.ENDPOINT,
        control_endpoint_predicate,
    )


if __name__ == "__main__":
    main()
