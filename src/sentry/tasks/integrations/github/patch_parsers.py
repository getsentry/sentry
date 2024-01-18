import re
from abc import abstractmethod
from typing import Set


class LanguageParser:
    @staticmethod
    @abstractmethod
    def extract_functions_from_patch(patch: str) -> Set[str]:
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


PATCH_PARSERS = {"py": PythonParser}
