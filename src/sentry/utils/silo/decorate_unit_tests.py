from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from functools import cached_property
from typing import Callable, Dict, Iterable, List, Mapping, Set, Tuple

from sentry.utils.silo.common import Keywords, has_control_name, has_region_name


def decorate_unit_tests(silo_keywords: Dict[str, Keywords]):
    pytest_collection = sys.stdin.read()

    case_map = TestCaseMap(TestCaseFunction.parse(pytest_collection))

    for (decorator, count) in case_map.report(
        "control_silo_test", "region_silo_test", classes_only=True
    ):
        print(f"{decorator or 'None'}: {count}")  # noqa

    def condition(match: TestCaseMatch) -> str | None:
        if not match.case.is_class:
            return None

        if has_control_name(match.case.name, silo_keywords):
            return "control_silo_test"
        elif has_region_name(match.case.name, silo_keywords):
            return "region_silo_test"

    count = case_map.add_decorators(condition)
    print(f"Decorated {count} case{'' if count == 1 else 's'}")  # noqa


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

    @property
    def pattern(self):
        decl = "class" if self.is_class else "def"
        return re.compile(rf"(\n@\w+\s*)*\n{decl}\s+{self.name}\s*\(")


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
    def top_level_file_map(self) -> Mapping[TopLevelTestCase, Set[str]]:
        top_level_file_map = defaultdict(set)
        for (case, filenames) in self.file_map.items():
            for filename in filenames:
                top_level_file_map[case.top_level].add(filename)
        return top_level_file_map

    @cached_property
    def case_matches(self) -> Iterable[TestCaseMatch]:
        case_matches = []
        for case in self.top_level_file_map:
            for path in self.top_level_file_map[case]:
                with open(path) as f:
                    src_code = f.read()
                match = case.pattern.search(src_code)
                if match:
                    decorator_matches = re.findall(r"@(\w+)", match.group())
                    decorators = tuple(str(m) for m in decorator_matches)
                    case_matches.append(TestCaseMatch(path, case, decorators))
        return tuple(case_matches)

    def report(
        self, *decorators: str, classes_only: bool = False
    ) -> Iterable[Tuple[(str | None), int]]:
        for decorator in decorators:
            count = sum(
                1
                for m in self.case_matches
                if (decorator in m.decorators) and (m.case.is_class or not classes_only)
            )
            yield decorator, count
        undecorated_count = sum(
            1
            for m in self.case_matches
            if all(d not in m.decorators for d in decorators)
            and (m.case.is_class or not classes_only)
        )
        yield None, undecorated_count

    def add_decorators(
        self, condition: Callable[[TestCaseMatch], (str | None)] | None = None
    ) -> int:
        count = 0
        for match in self.case_matches:
            decorator = condition(match)
            if decorator:
                result = match.add_decorator(decorator)
                count += int(result)
        return count


@dataclass(frozen=True, eq=True)
class TestCaseMatch:
    path: str
    case: TopLevelTestCase
    decorators: Tuple[str]

    def add_decorator(self, decorator: str) -> bool:
        if decorator in self.decorators:
            return False
        with open(self.path) as f:
            src_code = f.read()
        new_code = self.case.pattern.sub(rf"\n@{decorator}\g<0>", src_code)
        if new_code == src_code:
            raise Exception(f"Failed to find case: {decorator=}; {self.path=}; {self.case=}")
        new_code = f"from sentry.testutils.silo import {decorator}\n{new_code}"
        with open(self.path, mode="w") as f:
            f.write(new_code)
        return True
