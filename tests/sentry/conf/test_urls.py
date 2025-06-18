from __future__ import annotations

from collections.abc import Generator

import pytest
from django.urls.resolvers import URLPattern, URLResolver, get_resolver


def get_urls(r: URLResolver, base: tuple[str, ...] = ()) -> Generator[tuple[tuple[str, ...], str]]:
    if r.pattern.regex.pattern != "":
        base = (*base, r.pattern.regex.pattern)
    for pat in r.url_patterns:
        if isinstance(pat, URLPattern):
            yield (*base, pat.pattern.regex.pattern), pat.lookup_str
        elif isinstance(pat, URLResolver):
            yield from get_urls(pat, base)
        else:
            raise AssertionError(f"??? {pat}")


@pytest.fixture(scope="session")
def urlpatterns():
    return tuple(get_urls(get_resolver()))


def test_suspicious_url_regexes(urlpatterns: tuple[tuple[tuple[str, ...], str], ...]) -> None:
    errors = []

    wrong_slash = []
    for parts, view in urlpatterns:
        for part in parts:
            if r"\/" in part:
                wrong_slash.append(f"- {view}: {parts}")

    if wrong_slash:
        errors.extend(
            [
                r"view regexes contain `\/` (this is not js, just use /):",
                "",
                *wrong_slash,
            ]
        )

    if errors:
        raise AssertionError(f'errors encountered in view urls:\n\n{"\n".join(errors)}')
