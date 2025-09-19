import itertools
import re
from importlib import import_module

from django.conf import settings
from django.core.management.base import BaseCommand
from django.urls import URLPattern, URLResolver

# --- UTILS ---


def snake_to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def final_cleanup(path: str) -> str:
    path = path.replace(r"\/", "/")
    path = re.sub(r"\([^)]*\)", "", path)  # remove leftover groups
    path = path.replace(".*", "")
    path = re.sub(r"//+", "/", path)

    # Ensure leading and trailing slash
    path = "/" + path.strip("/")

    if not path.endswith("/"):
        path += "/"

    return path


def replace_named_groups(regex: str) -> str:
    result = []
    last_end = 0

    # Match all `(?P<paramName>...)` groups, even with nested `(...)` inside
    pattern = re.compile(r"\(\?P<(\w+)>")

    for match in pattern.finditer(regex):
        start = match.start()
        name = match.group(1)

        # Find the matching closing parenthesis for this group
        depth = 1
        i = match.end()
        while i < len(regex):
            if regex[i] == "(":
                depth += 1
            elif regex[i] == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1

        # If we couldn't find the end, skip the group entirely (fail-safe)
        if depth != 0:
            continue

        # Append text before the match and the replacement
        result.append(regex[last_end:start])
        result.append(f"${snake_to_camel(name)}")
        last_end = i + 1  # skip the closing ')'

    # Append the rest
    result.append(regex[last_end:])
    return "".join(result)


def convert_django_regex_to_ts_all(regex: str) -> list[str]:
    regex = regex.strip("^$")

    regex = replace_named_groups(regex)

    # Handle non-capturing groups (e.g. (?:x|y) → x and y)
    pattern = r"\(\?:([^)]+)\)"
    matches = list(re.finditer(pattern, regex))

    # Also detect optional static segments like 'plugins?'
    optional_pattern = r"([a-zA-Z0-9_-]+)\?"
    matches += list(re.finditer(optional_pattern, regex))

    if not matches:
        return [final_cleanup(regex)]

    # Build route combinations
    parts = []
    last_end = 0

    for match in matches:
        start, end = match.span()
        parts.append([regex[last_end:start]])

        if match.re.pattern == pattern:
            parts.append(match.group(1).split("|"))
        else:
            token = match.group(1)
            parts.append([token, ""])  # with or without the optional char

        last_end = end

    parts.append([regex[last_end:]])

    combos = itertools.product(*parts)
    return [final_cleanup("".join(c)) for c in combos]


def normalize_regex_part(regex: str) -> str:
    return regex.strip("^$")


def extract_ts_routes(urlpatterns, prefix="") -> list[str]:
    routes = []

    for pattern in urlpatterns:
        if isinstance(pattern, URLPattern):
            raw_regex = normalize_regex_part(pattern.pattern.regex.pattern)
            full_path = prefix + raw_regex
            ts_paths = convert_django_regex_to_ts_all(full_path)
            for path in ts_paths:
                routes.append(f"'{path}'")

        elif isinstance(pattern, URLResolver):
            new_prefix = prefix + normalize_regex_part(pattern.pattern.regex.pattern)
            routes.extend(extract_ts_routes(pattern.url_patterns, new_prefix))

    return routes


# --- COMMAND ---


class Command(BaseCommand):
    help = "Generate TypeScript route types from Django urlpatterns"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="routes.ts",
            help="Output file for TypeScript route types",
        )
        parser.add_argument(
            "--urls",
            type=str,
            default=settings.ROOT_URLCONF,
            help="Python path to root URLconf (default: settings.ROOT_URLCONF)",
        )

    def handle(self, *args, **options):
        urls_module_path = options["urls"]
        output_file = options["output"]

        self.stdout.write(f"🔍 Loading URLconf: {urls_module_path}")
        urlconf = import_module(urls_module_path)
        urlpatterns = getattr(urlconf, "urlpatterns", [])

        ts_routes = extract_ts_routes(urlpatterns)
        ts_routes = sorted(set(ts_routes))

        with open(output_file, "w") as f:
            f.write("/* prettier-ignore */\n")
            f.write("// Auto-generated TypeScript route types\n")
            f.write(
                "// To update it run `sentry django generate_ts_api_routes --urls sentry.api.urls --output=path/to/thisfile.ts`\n"
            )
            f.write("export type KnownApiUrls =\n")
            for route in ts_routes:
                f.write(f"  | {route}\n")
            f.write(";\n")

        self.stdout.write(self.style.SUCCESS(f"✅ Wrote {len(ts_routes)} routes to {output_file}"))
