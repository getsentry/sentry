def csp_has_directive(csp: str, key: str, include_values: list[str], exclude_values: list[str]):
    for directive in csp.split(";"):
        directive = directive.strip()
        if directive.startswith(key):
            values = directive.split()[1:]
            return all(v in values for v in include_values) and all(
                v not in values for v in exclude_values
            )
    return False
