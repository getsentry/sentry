from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import Any

from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Function, Op

from sentry.tasks.integrations.github.constants import STACKFRAME_COUNT

stackframe_function_name = lambda i: Function(
    "arrayElement",
    (Column("exception_frames.function"), i),
)


class LanguageParser(ABC):
    @staticmethod
    @abstractmethod
    def extract_functions_from_patch(patch: str) -> set[str]:
        pass

    @staticmethod
    @abstractmethod
    def generate_multi_if(function_names: list[str]) -> list[Function]:
        """
        Function to generate the multi-if condition for the Snuba request.
        This is to fetch the proper function name from the stacktrace, which is an array.
        """

    @staticmethod
    @abstractmethod
    def generate_function_name_conditions(
        function_names: list[str], stack_frame: int
    ) -> BooleanCondition | Condition:
        """
        Function to generate the WHERE condition for matching function names from a list to function names in the stack trace in the Snuba request.
        Must be applied to each frame of the stacktrace up to STACKFRAME_COUNT.
        """


class PythonParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

    @staticmethod
    def extract_functions_from_patch(patch: str) -> set[str]:
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
    def generate_multi_if(function_names: list[str]) -> list[Function]:
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
    def generate_function_name_conditions(function_names: list[str], stack_frame: int) -> Condition:
        """Check if the function name in the stack frame is within the list of function names."""
        return Condition(
            stackframe_function_name(stack_frame),
            Op.IN,
            function_names,
        )


class JavascriptParser(LanguageParser):
    issue_row_template = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** `Affected Users:` **{affected_users}** |"

    @staticmethod
    def extract_functions_from_patch(patch: str) -> set[str]:
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

    @staticmethod
    def _get_function_name_conditions(stackframe_level: int, function_names: list[str]):
        """
        For Javascript we need a special case of matching both for the function name itself and for
        "." + the function name, because sometimes Snuba stores the function name as "className.FunctionName".
        """
        prepended_function_names = ["%." + function_name for function_name in function_names]
        function_name_conditions = [
            Condition(
                stackframe_function_name(stackframe_level),
                Op.LIKE,
                function_name,
            )
            for function_name in prepended_function_names
        ]
        function_name_conditions.append(
            Condition(
                stackframe_function_name(stackframe_level),
                Op.IN,
                function_names,
            ),
        )
        return function_name_conditions

    @staticmethod
    def _get_function_name_functions(stackframe_level: int, function_names: list[str]):
        """
        This is used in the multi_if. We need to account for the special Javascript cases in order to
        properly fetch the function name -- "className.FunctionName" or simply "functionName" depending
        on what matches in the stack trace.
        """
        prepended_function_names = ["%." + function_name for function_name in function_names]
        function_name_conditions = [
            Function(
                "like",
                [
                    stackframe_function_name(stackframe_level),
                    function_name,
                ],
            )
            for function_name in prepended_function_names
        ]
        function_name_conditions.append(
            Function(
                "in",
                [
                    stackframe_function_name(stackframe_level),
                    function_names,
                ],
            )
        )
        return function_name_conditions

    @staticmethod
    def generate_multi_if(function_names: list[str]) -> list[Function]:
        """
        Fetch the function name from the stackframe that matches a name within the list of function names.
        """
        multi_if = []
        for i in range(-STACKFRAME_COUNT, 0):
            # if, then conditions
            stackframe_function_name_conditions = JavascriptParser._get_function_name_functions(
                i, function_names
            )
            multi_if.extend(
                [
                    Function("or", stackframe_function_name_conditions),
                    stackframe_function_name(i),
                ]
            )
        # else condition
        multi_if.append(stackframe_function_name(-1))

        return multi_if

    @staticmethod
    def generate_function_name_conditions(function_names: list[str], stack_frame: int) -> Condition:
        """Check if the function name in the stack frame is within the list of function names."""
        return BooleanCondition(
            BooleanOp.OR,
            JavascriptParser._get_function_name_conditions(stack_frame, function_names),
        )


PATCH_PARSERS: dict[str, Any] = {
    "py": PythonParser,
    "js": JavascriptParser,
    "jsx": JavascriptParser,
    "ts": JavascriptParser,
    "tsx": JavascriptParser,
}

# for testing new parsers
BETA_PATCH_PARSERS: dict[str, Any] = {
    "py": PythonParser,
    "js": JavascriptParser,
    "jsx": JavascriptParser,
    "ts": JavascriptParser,
    "tsx": JavascriptParser,
}
