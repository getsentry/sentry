import re

from snuba_sdk import Condition, Op

from sentry.integrations.source_code_management.language_parsers import (
    PATCH_PARSERS,
    LanguageParser,
    PythonParser,
    SimpleLanguageParser,
    stackframe_function_name,
)


def simple_function_name_conditions(
    function_names: list[str],
    stack_frame_idx: int,
):
    return Condition(stackframe_function_name(stack_frame_idx), Op.IN, function_names)


class PythonParserMore(PythonParser):
    @classmethod
    def extract_functions_from_rest_of_patch(cls, patch: str) -> set[str]:
        r"""
        Extract function names from a patch, excluding those in hunk headers.

        Regex:
        ^                        - Start of line
        [\- ]                    - Match a '-', or space character (removed or context lines)
        (?:\s*)                  - Match any whitespace characters (indentation) without capturing
        def\s+                   - Match the 'def' keyword followed by whitespace
        ([a-zA-Z_][a-zA-Z0-9_]*) - Capture the function name, which must start with a letter or
                                   underscore followed by letters, numbers, or underscores
        """
        pattern = r"^[\- ](?:\s*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)"
        matches = re.finditer(pattern, patch, re.MULTILINE)
        return {match.group(1) for match in matches if match.group(1)}

    @classmethod
    def extract_functions_from_patch(cls, patch: str) -> set[str]:
        function_names_from_hunk_headers = super().extract_functions_from_patch(patch)
        function_names_from_rest_of_patch = cls.extract_functions_from_rest_of_patch(patch)
        return function_names_from_hunk_headers | function_names_from_rest_of_patch


patch_parsers_more: dict[str, type[SimpleLanguageParser] | type[LanguageParser]] = PATCH_PARSERS | {
    "py": PythonParserMore,
}
"""
Parsers that extract function names from the entire patch (hunk headers, diff, context), excluding
added functions.

May have false positives.
"""
