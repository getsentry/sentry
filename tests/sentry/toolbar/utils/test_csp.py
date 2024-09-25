from sentry.toolbar.utils.csp import csp_add_directive


def get_directives(csp: str) -> dict[str, set[str]]:
    res = {}
    for directive in csp.split(";"):
        directive = directive.strip()
        key, *values = directive.split()
        res[key] = set(values)
    return res


def run_test(csp: str, new_key: str, new_values: list[str]) -> dict[str, set[str]]:
    new_csp = csp_add_directive(csp, new_key, new_values)
    dirs = get_directives(csp)
    new_dirs = get_directives(new_csp)
    assert new_key in new_dirs
    for key in new_dirs:
        if key != new_key:
            assert key in dirs and new_dirs[key] == dirs[key]
        else:
            assert new_dirs[key] == dirs.get(key, set()).union(set(new_values))
    return new_dirs


def test_csp_add_directive_new():
    run_test(
        "media-src *; img-src * blob: data:; base-uri 'none'",
        "script-src",
        ["'unsafe-inline'", "'report-sample'"],
    )


def test_csp_add_directive_exists():
    run_test(
        "media-src *; img-src * blob: data:; base-uri 'none'; script-src 'self'",
        "script-src",
        ["*.sentry.io"],
    )

    run_test(
        "media-src *; img-src * blob: data:; script-src 'report-sample'; base-uri 'none'",
        "script-src",
        ["*.sentry.io", "sentry.io"],
    )


def test_csp_add_directive_dup_value():
    directives = run_test(
        "script-src 'self'",
        "script-src",
        ["'self'"],
    )
    assert len(directives["script-src"]) == 1
