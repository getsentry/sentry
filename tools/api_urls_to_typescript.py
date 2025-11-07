#!/usr/bin/env python3
# flake8: noqa: S002

import re
from typing import Any

from django.urls import URLPattern, URLResolver


def snake_to_camel_case(value: str) -> str:
    """
    Converts a string from snake_case to camelCase
    """
    words = value.strip("_").split("_")
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


def urls_to_routes(prefix: str, urlpatterns: list[Any]) -> list[str]:
    routes = []
    for urlpattern in urlpatterns:
        if isinstance(urlpattern, URLResolver):
            children = regexp_to_routes(urlpattern.pattern.regex.pattern)
            for child in children:
                routes += urls_to_routes(prefix + child, urlpattern.url_patterns)
        elif isinstance(urlpattern, URLPattern):
            variants = regexp_to_routes(urlpattern.pattern.regex.pattern)
            routes += [prefix + variant for variant in variants]
        else:
            raise ValueError(f"Unknown pattern type: {type(urlpattern)}")
    return routes


def regexp_to_routes(regexp_string: str) -> list[str]:
    """
    Convert a regexp string to a route-style string.

    Handles:
    - Stripping ^ and $ from start/end
    - Converting named groups like (?P<name>pattern) to :name
    - Breaking out alternates like (?:a|b) into separate routes

    Args:
        regexp_string: The regexp pattern to convert

    Returns:
        Either a single route string or a list of route strings for alternates

    Examples:
        >>> regexp_to_route(r'^(?P<issue_id>[^/]+)/plugins?/$')
        ':issue_id/plugins/'
        >>> regexp_to_route(r'/(?:issues|groups)/')
        ['/issues/', '/groups/']
        >>> regexp_to_route(r'^api/v1/(?P<org_slug>[^/]+)/$')
        'api/v1/:org_slug/'
    """
    # Strip ^ and $ from start and end
    pattern = regexp_string.strip("^$")

    # Check for alternates (non-capturing groups with |) that are NOT inside named groups
    alternate_pattern = r"\((?:\?\:([^)]+))\)"

    # Find all matches and check if they're inside named groups
    matches = list(re.finditer(alternate_pattern, pattern))

    # Filter out matches that are inside named groups
    valid_alternates = []
    for match in matches:
        # Check if this match is inside a named group by looking backwards
        start_pos = match.start()
        in_named_group = False

        # Look backwards for the most recent unclosed (?P<
        i = start_pos - 1
        paren_count = 0
        while i >= 0:
            if pattern[i] == ")":
                paren_count += 1
            elif pattern[i] == "(":
                if paren_count == 0:
                    # Check if this is a named group by looking for (?P<
                    if i + 2 < len(pattern) and pattern[i : i + 3] == "(?P":
                        # Look ahead to see if there's a < after the P
                        if i + 3 < len(pattern) and pattern[i + 3] == "<":
                            in_named_group = True
                            break
                # Only decrement paren_count if we didn't find a named group
                if not in_named_group:
                    paren_count -= 1
            i -= 1

        if not in_named_group:
            valid_alternates.append(match)

    if valid_alternates:
        # Use the first valid alternate
        alternate_match = valid_alternates[0]
        # Extract the alternatives
        alternatives = alternate_match.group(1).split("|")

        # Process each alternative
        routes = []
        for alt in alternatives:
            # Clean up the alternative
            alt = alt.strip()

            # Create the full pattern by replacing the alternate group with this alternative
            full_pattern = pattern.replace(alternate_match.group(0), alt)
            route = _process_single_pattern(full_pattern)
            routes.append(route)
        return routes
    return [_process_single_pattern(pattern)]


def _process_single_pattern(pattern: str) -> str:
    """Process a single regexp pattern into a route string."""
    # Convert named groups (?P<name>pattern) to :name
    # This regex matches (?P<name>...) and captures the name, handling nested groups
    named_group_pattern = r"\(\?P<([^>]+)>([^)]*(?:\([^)]*\)[^)]*)*)\)"

    def replace_named_group(match: re.Match[str]) -> str:
        group_name = snake_to_camel_case(match.group(1))
        return f"${group_name}"

    # First, clean up nested patterns inside named groups
    # Remove non-capturing groups that aren't alternates (already handled)
    # This handles patterns like (?:\d+|[A-Fa-f0-9]{32})
    pattern = re.sub(r"\(\?\:[^)]+\)", "", pattern)

    # Remove quantifiers like {32}
    pattern = re.sub(r"\{[^}]+\}", "", pattern)

    # Remove character classes like [^/]+ and replace with just the placeholder
    pattern = re.sub(r"\[[^\]]+\]\+?", "", pattern)

    # Replace all named groups (including those with nested patterns)
    route = re.sub(named_group_pattern, replace_named_group, pattern)

    # Remove optional groups markers (but not the ? after characters)
    route = re.sub(r"\(\?[^)]*\)", "", route)

    # Handle optional characters (like s? -> s)
    route = re.sub(r"([^/])\?", r"\1", route)

    # Handle optional trailing slash
    route = re.sub(r"/\?$", "/", route)

    # Clean up any double slashes that might have been created
    route = re.sub(r"/+", "/", route)

    # Remove trailing slashes from the end if they were added by cleaning
    if route.endswith("/") and not route.endswith("//"):
        pass  # Keep single trailing slash
    elif route.endswith("//"):
        route = route.rstrip("/") + "/"

    return route


def main() -> int:
    import sys

    from sentry.runner import configure

    configure()

    from sentry.api.urls import urlpatterns

    route_patterns = sorted(set(urls_to_routes("/", urlpatterns)))

    command = len(sys.argv) > 1 and sys.argv[1]
    if command == "list":
        for route_pattern in route_patterns:
            print(route_pattern)
    else:
        with open("static/app/utils/api/knownSentryApiUrls.generated.ts", "w") as f:
            f.writelines(
                [
                    "/**\n",
                    " * GENERATED FILE. Do not edit manually.\n",
                    " * To update it run `python3 -m tools.api_urls_to_typescript`\n",
                    " *\n",
                    " * This file is the sibling to knownGetsentryApiUrls.ts.\n",
                    " *\n",
                    " * DEPLOYMENT: This is safe to deploy alongside backend changes.\n",
                    " */\n\n",
                    "export type KnownSentryApiUrls =\n",
                    "\n".join([f"  | '{r}'" for r in route_patterns]) + ";\n",
                ]
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
