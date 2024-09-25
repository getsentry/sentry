def csp_add_directive(csp: str, new_key: str, new_values: list[str]):
    """
    Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
    Assumes csp is valid - each directive is a space-separated list of 1 key and 1+ values.
    """
    new_csp = ""
    seen_key = False
    for directive in csp.split(";"):
        directive = directive.strip()
        if not directive:
            continue

        key, val = directive.split(maxsplit=1)
        if key == new_key:
            new_values = set(new_values + val.split())
            val = " ".join(new_values)
            seen_key = True
        new_csp += f"{key} {val};"

    if not seen_key:
        new_csp += f"{new_key} {' '.join(new_values)};"
    return new_csp[:-1]
