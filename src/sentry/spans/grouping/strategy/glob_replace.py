import re
from typing import Match

GLOB_REGEX = re.compile(r"\*\*|\*")

SINGLE_STAR = "([^/]*?)"
DOUBLE_STAR = "(?:.*?)"

WILDCARD_CHARACTER = "*"


def glob_replace(source: str, glob: str) -> str:
    """
    Given a source string and a glob, replaces all globbed chunks of the source
    string with the replacement character.

    Matches to an asterisk are replaces with an asterisk. Matches to a double
    asterisk are kept as-is.

    e.g., given the string `"hello there world friends"` and the glob `"hello *
    world**"` returns the string `"hello * world friends"`
    """

    regex_pattern_equivalent_to_glob = re.sub(GLOB_REGEX, replace_glob_with_regex_group, glob)
    regex_equivalent_to_glob = re.compile(f"^{regex_pattern_equivalent_to_glob}$")

    match = re.search(regex_equivalent_to_glob, source)
    if not match:  # If the glob fails, the rule is not applicable. Return the original string
        return source

    new_source = ""
    curr = 0

    for i in range(1, regex_equivalent_to_glob.groups + 1):  # Group 0 is the entire match
        span = match.span(i)

        new_source += source[curr : span[0]]
        new_source += WILDCARD_CHARACTER
        curr = span[1]

    new_source += source[curr:]

    return new_source


def replace_glob_with_regex_group(match: Match) -> str:
    if match.group() == "**":
        return DOUBLE_STAR

    if match.group() == "*":
        return SINGLE_STAR

    return match.group()  # Unknown glob type
