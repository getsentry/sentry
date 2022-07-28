#!.venv/bin/python

from __future__ import annotations

import os
import re
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from functools import cached_property
from typing import Callable, Iterable, List, Mapping

"""Add server mode decorators to unit test cases en masse.

Unlike `audit_mode_limits`, this script can't really reflect on interpreted
Python code in order to distinguish unit tests. It instead relies on an external
`pytest` run to collect the list of test cases, and some does kludgey regex
business in order to apply the decorators.

It has no knowledge of whether decorators are already applied, and will write
redundant decorators if you let it. If this becomes a problem, it's probably
easiest just to clean them up with a global find-and-replace.


Instructions for use:

From the Sentry project root, do
    ./scripts/servermode/audit_unit_tests.py

Running `pytest` to collect unit test cases can be quite slow. To speed up
repeated runs, first do
    pytest --collect-only > pytest-collect.txt
to cache the description of test cases on disk. Delete the file to refresh.
"""


@dataclass(frozen=True, eq=True)
class TestCaseFunction:
    """Model a function representing a test case.

    The function may be either a top-level function or a test class method.
    """

    package: str | None
    module: str
    class_name: str | None
    func_name: str
    arg: str | None

    @staticmethod
    def parse(collect_output: str) -> Iterable[TestCaseFunction]:
        package = None
        module = None
        class_name = None

        for match in re.finditer(r"\n+(\s*)<(\w+)\s+(.*?)(\[.*?])?>", collect_output):
            indent, tag, value, arg = match.groups()
            if tag == "Package":
                package = value
                module = None
                class_name = None
            elif tag == "Module":
                if len(indent) == 0:
                    package = None
                module = value
                class_name = None
            elif tag in ("Class", "UnitTestCase"):
                class_name = value
            elif tag in ("Function", "TestCaseFunction"):
                if module is None:
                    raise ValueError
                yield TestCaseFunction(package, module, class_name, value, arg)
            elif tag != "frozen":
                raise ValueError(f"Unrecognized tag: {tag!r}")

    @property
    def top_level(self) -> TopLevelTestCase:
        return TopLevelTestCase(
            self.package,
            self.module,
            self.class_name or self.func_name,
            self.class_name is not None,
        )


@dataclass(frozen=True, eq=True)
class TopLevelTestCase:
    """A key for a top-level test case.

    Represents either a test class or a stand-alone test function.
    """

    package: str | None
    module: str
    name: str
    is_class: bool


class TestCaseMap:
    def __init__(self, cases: Iterable[TestCaseFunction]) -> None:
        self.cases = tuple(cases)

    @cached_property
    def file_map(self) -> Mapping[TestCaseFunction, List[str]]:
        groups = defaultdict(lambda: defaultdict(list))
        for c in self.cases:
            groups[c.package][c.module].append(c)

        file_map = defaultdict(list)

        for (module, cases) in groups[None].items():
            for case in cases:
                file_map[case].append(module)

        for (dirpath, dirnames, filenames) in os.walk("tests"):
            _, current_dirname = os.path.split(dirpath)
            if current_dirname in groups:
                modules = groups[current_dirname]
                for filename in filenames:
                    if filename in modules:
                        path = os.path.join(dirpath, filename)
                        for case in modules[filename]:
                            file_map[case].append(path)

        return file_map

    @cached_property
    def top_level_file_map(self):
        top_level_file_map = defaultdict(set)
        for (case, filenames) in self.file_map.items():
            for filename in filenames:
                top_level_file_map[case.top_level].add(filename)
        return top_level_file_map

    def decorate_all_top_level(
        self, condition: Callable[[TopLevelTestCase], (str | None)] | None = None
    ):
        for case in self.top_level_file_map:
            decorator_name = condition(case)
            if decorator_name:
                self.decorate_top_level(case, decorator_name)

    def decorate_top_level(self, case: TopLevelTestCase, decorator_name: str):
        for path in self.top_level_file_map[case]:
            with open(path) as f:
                src_code = f.read()
            decl = "class" if case.is_class else "def"
            new_code = re.sub(
                rf"\n{decl}\s+{case.name}\s*\(",
                rf"\n@{decorator_name}\g<0>",
                src_code,
            )
            if new_code != src_code:
                new_code = f"from sentry.testutils.servermode import {decorator_name}\n" + new_code
                with open(path, mode="w") as f:
                    f.write(new_code)


# Do `pytest --collect-only > pytest-collect.txt` to speed up repeated local runs
LOCAL_SAVE = "pytest-collect.txt"


def main(test_root="."):
    if os.path.exists(LOCAL_SAVE):
        with open(LOCAL_SAVE) as f:
            pytest_collection = f.read()
    else:
        process = subprocess.run(["pytest", test_root, "--collect-only"], capture_output=True)
        pytest_collection = process.stdout.decode("utf-8")

    case_map = TestCaseMap(TestCaseFunction.parse(pytest_collection))

    def condition(case: TopLevelTestCase) -> str | None:
        if not case.is_class:
            return None
        if any(
            (word in case.name)
            for word in ("Organization", "Project", "Team", "Group", "Event", "Issue")
        ):
            return "customer_silo_test"

    case_map.decorate_all_top_level(condition)


if __name__ == "__main__":
    main()
