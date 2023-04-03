import re
from typing import Pattern

SINGLE_STAR = "([^/]*?)"
DOUBLE_STAR = "(?:.*?)"


def glob_replace(source: str, rule: str) -> str:

    # Replace instances of
    compiled_rule = compile_rule(rule)
    match = re.search(compiled_rule, source)
    new_source = ""

    curr = 0
    for i in range(1, compiled_rule.groups + 1):

        group = match.group(i)
        print("group", group)
        span = match.span(i)
        print("span", span)

        if i == 0:
            continue

        new_source += source[curr : span[0]]
        print("new source", new_source)
        new_source += "*"
        curr = span[1]

    print("done iterating", curr)
    print("new source", new_source)

    print(curr)
    print(source[curr:])

    new_source += source[curr:]

    print("new source", new_source)

    return new_source


# TODO: ? replacement support, maybe
REPLACEMENT_REGEX = re.compile(r"\*\*|\*")


def compile_rule(rule: str) -> Pattern[str]:
    # TODO: Improve the code
    # TODO: Allow escaping wildcards
    print("compiling rule")

    new_rule = re.sub(REPLACEMENT_REGEX, replace, rule)
    print("made rule", f"^{new_rule}$")
    return re.compile(f"^{new_rule}$")


def replace(match):
    # print("replacing", match)
    # print(match == "**")
    if match.group() == "**":
        return DOUBLE_STAR

    if match.group() == "*":
        return SINGLE_STAR
