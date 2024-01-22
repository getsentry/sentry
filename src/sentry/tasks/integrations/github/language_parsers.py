from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import List, Set

from snuba_sdk import BooleanCondition, Column, Condition, Function, Op

from sentry.tasks.integrations.github.constants import STACKFRAME_COUNT

stackframe_function_name = lambda i: Function(
    "arrayElement",
    (Column("exception_frames.function"), i),
)


class LanguageParser(ABC):
    @staticmethod
    @abstractmethod
    def extract_functions_from_patch(patch: str) -> Set[str]:
        pass

    @staticmethod
    @abstractmethod
    def generate_multi_if(function_names: List[str]) -> List[Function]:
        """
        Function to generate the multi-if condition for the Snuba request.
        This is to fetch the proper function name from the stacktrace, which is an array.
        """
        pass

    @staticmethod
    @abstractmethod
    def generate_function_name_conditions(
        function_names: List[str], stack_frame: int
    ) -> BooleanCondition | Condition:
        """
        Function to generate the WHERE condition for matching function names from a list to function names in the stack trace in the Snuba request.
        Must be applied to each frame of the stacktrace up to STACKFRAME_COUNT.
        """
        pass


class PythonParser(LanguageParser):
    @staticmethod
    def extract_functions_from_patch(patch: str) -> Set[str]:
        r"""
        Function header regex pattern
        ^           - Asserts the start of a line.
        @@.*@@      - Matches a string that starts with two "@" characters, followed by any characters
                    (except newline), and ends with two "@" characters.
        \s+         - Matches one or more whitespace characters (spaces, tabs, etc.).
        def         - Matches the literal characters "def".
        \\s+         - Matches one or more whitespace characters.
        (?P<fnc>.*) - This is a named capturing group that captures any characters (except newline)
                    and assigns them to the named group "fnc".
        \(          - Matches an opening parenthesis "(".
        .*          - Matches any characters (except newline).
        $           - Asserts the end of a line.
        """
        python_function_regex = r"^@@.*@@\s+def\s+(?P<fnc>.*)\(.*$"
        return set(re.findall(python_function_regex, patch, flags=re.M))

    @staticmethod
    def generate_multi_if(function_names: List[str]) -> List[Function]:
        """
        Fetch the function name from the stackframe that matches a name within the list of function names.
        """
        multi_if = []
        for i in range(-STACKFRAME_COUNT, 0):
            # if, then conditions
            multi_if.extend(
                [
                    Function(
                        "in",
                        [
                            stackframe_function_name(i),
                            function_names,
                        ],
                    ),
                    stackframe_function_name(i),
                ]
            )
        # else condition
        multi_if.append(stackframe_function_name(-1))

        return multi_if

    @staticmethod
    def generate_function_name_conditions(function_names: List[str], stack_frame: int) -> Condition:
        """Check if the function name in the stack frame is within the list of function names."""
        return Condition(
            stackframe_function_name(stack_frame),
            Op.IN,
            function_names,
        )


class JavascriptParser(LanguageParser):
    @staticmethod
    def extract_functions_from_patch(patch: str) -> Set[str]:
        r"""
        Type of function declaration    Example
        Function declaration:           function hello(argument1, argument2)
        Arrow function:                 export const blue = (argument) => {
        Function expression:            const planet = async function(argument) {
        Function constructor:           const constructor = new Function(
        """
        function_declaration_regex = r"^@@.*@@[^=]*?\s*function\s+(?P<fnc>[^\(]*)\(.*$"
        arrow_function_regex = (
            r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^=]*)\s+=[^>|^\n]*[\(^\n*\)]?\s*=>.*$"
        )
        function_expression_regex = (
            r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^\(]*)\s+=.*\s+function.*\(.*$"
        )
        function_constructor_regex = (
            r"^@@.*@@.*\s+\b(?:var|const)\b\s+(?P<fnc>[^\(]*)\s+=\s+new\s+Function\(.*$"
        )

        regexes = [
            function_declaration_regex,
            arrow_function_regex,
            function_expression_regex,
            function_constructor_regex,
        ]

        functions = set()
        for regex in regexes:
            functions.update(set(re.findall(regex, patch, flags=re.M)))

        return functions


PATCH_PARSERS = {"py": PythonParser}
