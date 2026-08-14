def normalize_clickhouse_meta(meta: list[dict[str, str]]) -> list[dict[str, str]]:
    """Collapse DateTime timezone spellings for meta comparisons.

    clickhouse-driver reported UTC DateTime as DateTime('Universal').
    clickhouse-connect / JSONCompact report DateTime or DateTime('UTC').
    Production mapping already treats all of these as dates.
    """
    normalized: list[dict[str, str]] = []
    for column in meta:
        typ = column.get("type", "")
        if typ.startswith("DateTime"):
            column = {**column, "type": "DateTime"}
        normalized.append(column)
    return normalized
