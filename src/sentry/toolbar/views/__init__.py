TOOLBAR_CSP_SCRIPT_SRC = ["'unsafe-inline'", "sentry.io", "*.sentry.io"]


def has_valid_csp(response):
    csp = response.headers.get("Content-Security-Policy")
    if csp:
        for d in csp.split(";"):
            d = d.strip()
            if d.startswith("script-src "):
                sources = d.split()[1:]
                return all([src in sources for src in TOOLBAR_CSP_SCRIPT_SRC])
    elif "Content-Security-Policy-Report-Only" in response.headers:
        return True
    return False
