import logging
import re
from collections.abc import Iterator

from django.urls.base import resolve
from django.urls.exceptions import Resolver404
from django.urls.resolvers import URLPattern, URLResolver, get_resolver
from django.utils.regex_helper import normalize

from apigw.web import app as apigw_app
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)

# Known mismatches between sentry's silo annotations and apigw routing,
# keyed by the url regex as collected by `iter_silo_routed_urls`. The goal is
# to drain this registry to zero: fix the apigw routes (or the sentry url /
# silo annotation) and remove the entry. Do not add new entries. Entries whose
# routing has been fixed make the test fail as stale and must be removed.
CELL_NO_ORG_SCOPE = "cell endpoint/view without org in path; falls through to control"
RELOCATION = "relocation endpoints; known issue, see cell-architecture known issues"

KNOWN_MISLEADING = {
    "500/",
    "404/",
    "403-csrf-failure/",
    "_warmup/",
    "api/client-config/?",
    "api/relay/.*",
    "_static/dist/(?P<module>[^/]+)/(?P<path>.*)",
    "_static/(?:(?P<version>\\d{10}|[a-f0-9]{32,40})/)?(?P<module>[^/]+)/(?P<path>.*)",
    "api/0/organizations/",
    "api/0/internal/health/",
    "api/0/internal/options/",
    "api/0/internal/frontend-version/",
    "api/0/internal/warnings/",
    "api/0/internal/packages/",
    "api/0/internal/environment/",
    "api/0/internal/mail/",
    "api/0/internal/feature-flags/",
    "api/0/uptime-ips/",
    "_chartcuterie-config\\.js",
    "",
    "robots\\.txt",
    "\\.well-known/security\\.txt",
    "\\.well-known/mcp\\.json",
    "favicon\\.ico",
    "plugins/github/installations/webhook/",
}
KNOWN_MISROUTED = {
    # Cell endpoints with no org in the path
    "api/0/internal/feature-flags/ea-feature-flags": CELL_NO_ORG_SCOPE,
    # The loader cell is resolved from the SDK public key, which apigw cannot
    # do yet; route to control and rely on its django gateway middleware
    # (SdkPublicKeyResolver) until apigw grows public-key-based resolution
    "js-sdk-loader/(?P<public_key>[^/\\.]+)(?:(?P<minified>\\.min))?\\.js": (
        "cell view routed to control; deferred public-key-based cell resolution"
    ),
    # Relocation endpoints; known issue, deferred to the Monarch project
    "api/0/relocations/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/abort/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/cancel/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/pause/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/recover/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/retry/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/unpause/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/artifacts/": RELOCATION,
    "api/0/relocations/(?P<relocation_uuid>[^/]+)/artifacts/(?P<artifact_kind>[^/]+)/(?P<file_name>[^/]+)": RELOCATION,
    "api/0/publickeys/relocations/": RELOCATION,
}

# Values used to materialize concrete URLs from named path parameters.
# Parameters not listed here fall back to the heuristics in `sample_param_value`.
SAMPLE_PARAM_VALUES = {
    "organization_id_or_slug": "test-org",
    "organization_slug": "test-org",
    "project_id_or_slug": "test-project",
    "project_slug": "test-project",
    "team_id_or_slug": "test-team",
    "team_slug": "test-team",
}


def sample_param_value(name: str) -> str:
    if name in SAMPLE_PARAM_VALUES:
        return SAMPLE_PARAM_VALUES[name]
    if "id" in name:
        return "123"
    return "test"


def iter_silo_routed_urls(
    resolver: URLResolver, prefix: str = ""
) -> Iterator[tuple[str, frozenset[SiloMode], object]]:
    """Yield (regex_pattern, silo_modes, callback) for every customer-facing url."""
    for pattern in resolver.url_patterns:
        # Use the compiled regex so path()-style routes are normalized too, and
        # drop the anchors so nested patterns concatenate into one valid regex.
        chunk = pattern.pattern.regex.pattern.removeprefix("^").removesuffix("$")
        full_pattern = prefix + chunk

        # URLs in remote/extensions are cell scoped but handled by the webhook
        # proxy middleware in sentry. See sentry/middleware/integrations
        if full_pattern.startswith(("remote/", "extensions/")):
            continue

        if isinstance(pattern, URLPattern):
            callback = pattern.callback

            view_class = getattr(callback, "view_class", None)
            if view_class:
                # endpoints and view classes
                silo_limit = getattr(view_class, "silo_limit", None)
            else:
                # view functions have the silo_limit monkeypatched onto the function.
                silo_limit = getattr(callback, "silo_limit", None)

            # Only django internal views. All sentry/getsentry views/functions
            # will have silo annotations on them. getsentry/tests/test_silo.py and
            # sentry/tests/silo/test_base.py ensure this.
            if silo_limit is None:
                continue

            # Internal endpoints don't need cell routing as they aren't accessed
            # directly by customers.
            if silo_limit.internal:
                continue

            yield (full_pattern, silo_limit.modes, callback)
        elif isinstance(pattern, URLResolver):
            yield from iter_silo_routed_urls(pattern, prefix=full_pattern)


def build_concrete_url(regex_pattern: str) -> str:
    """Turn a url regex into a concrete path, filling params with sample values."""
    # normalize() cannot reverse non-capturing alternations like (?:issues|groups);
    # collapse them to their first alternative. The re-resolution check below
    # guards against this picking a string that no longer matches the pattern.
    flattened = re.sub(r"\(\?:([^()|]+)(?:\|[^()]+)+\)", r"\1", regex_pattern)
    possibilities = normalize(flattened)
    # Prefer the variant with the most parameters so optional segments are exercised.
    template, params = max(possibilities, key=lambda possibility: len(possibility[1]))
    return "/" + template % {name: sample_param_value(name) for name in params}


def resolves_to(url: str, callback: object) -> bool:
    """Check the concrete url still resolves to the view it was generated from."""
    try:
        match = resolve(url)
    except Resolver404:
        return False
    return match.func == callback


def apigw_match_url(url: str) -> str | None:
    # At runtime emmett strips trailing slashes before matching
    # (see emmett_core.routing.router.Router.match); mirror that here.
    path = url.rstrip("/") or url
    match, _ = apigw_app._router_http.match_route_direct("GET", path)
    return match.name if match else None


def test_urls() -> None:
    tested = 0
    skipped: list[str] = []
    failures: list[str] = []
    known_misleading_hits: set[str] = set()
    known_misrouted_hits: set[str] = set()

    for regex_pattern, silo_modes, callback in iter_silo_routed_urls(get_resolver()):
        try:
            url = build_concrete_url(regex_pattern)
        except (KeyError, ValueError):
            skipped.append(regex_pattern)
            continue
        if not resolves_to(url, callback):
            skipped.append(regex_pattern)
            continue

        if SiloMode.CONTROL not in silo_modes:
            expected = "cell"
        elif SiloMode.CELL not in silo_modes:
            expected = "control"
        elif all(mode in silo_modes for mode in [SiloMode.CONTROL, SiloMode.CELL]):
            known_misleading_hits.add(regex_pattern)
            expected = "control"
            if regex_pattern not in KNOWN_MISLEADING:
                failures.append(
                    f"{regex_pattern} is misleading and unknown: update KNOWN_MISLEADING "
                    f"if control is expected from apigw routing, else update apigw routing"
                )
        else:
            failures.append(f"{url}: unexpected silo modes {silo_modes}")
            continue

        tested += 1
        route_name = apigw_match_url(url)
        misrouted = route_name is None or expected not in route_name
        if misrouted:
            if regex_pattern in KNOWN_MISROUTED:
                known_misrouted_hits.add(regex_pattern)
            else:
                failures.append(
                    f"{url} (from {regex_pattern}): expected a {expected} route, "
                    f"apigw matched {route_name!r}"
                )

    stale_misrouted = [
        pattern for pattern in KNOWN_MISROUTED if pattern not in known_misrouted_hits
    ]
    failures.extend(
        f"{pattern}: KNOWN_MISROUTED entry no longer fails (or its url is gone); remove it"
        for pattern in stale_misrouted
    )

    stale_misleading = KNOWN_MISLEADING - known_misleading_hits
    failures.extend(
        f"{pattern}: KNOWN_MISLEADING entry no longer present; remove it"
        for pattern in stale_misleading
    )

    if skipped:
        logger.warning(
            "Skipped %d url patterns that could not be materialized:\n%s",
            len(skipped),
            "\n".join(skipped),
        )

    assert tested > 0, "No urls were tested; the url collection is broken"
    assert not failures, f"{len(failures)} urls misrouted by apigw:\n" + "\n".join(failures)
