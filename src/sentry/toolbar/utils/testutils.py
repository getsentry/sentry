def has_csp_script_src_nonce(response):
    """
    Checks the CSP header has the directives required to run the toolbar's inline scripts.
    If enforced, the "script-src" directive needs to include a nonce.
    """
    if "Content-Security-Policy-Report-Only" in response.headers:
        # This indicates CSP is not being enforced.
        return True

    csp = response.headers.get("Content-Security-Policy", "")
    for d in csp.split(";"):
        d = d.strip()
        if d.startswith("script-src "):
            sources = d.split()[1:]
            return any([src.startswith("'nonce-") for src in sources])
    return False
