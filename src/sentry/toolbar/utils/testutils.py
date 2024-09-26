def has_valid_csp(response):
    """
    Checks the CSP header has the directives required to run the toolbar's inline scripts.
    """
    if (
        "Content-Security-Policy-Report-Only" in response.headers
    ):  # This indicates CSP is not enforced.
        return True

    csp = response.headers.get("Content-Security-Policy", "")
    for d in csp.split(";"):
        d = d.strip()
        if d.startswith("script-src "):
            sources = d.split()[1:]
            return any(
                [src == "'unsafe-inline'" or src.startswith("'nonce-") for src in sources]
            )  # TODO: test nonce case more
    return False
