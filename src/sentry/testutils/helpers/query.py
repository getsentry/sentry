from __future__ import annotations

from typing import Any

import sqlparse
from sqlparse.tokens import DML

__all__ = ("parse_queries",)


def parse_queries(captured_queries: list[dict[str, Any]]) -> dict[str, int]:
    write_ops = ["INSERT", "UPDATE", "DELETE"]

    real_queries: dict[str, int] = {}

    for query in captured_queries:
        raw_sql = query["sql"]
        parsed = sqlparse.parse(raw_sql)
        for token_index, token in enumerate(parsed[0].tokens):
            if token.ttype is DML:
                if token.value.upper() in write_ops:
                    for t in parsed[0].tokens[token_index + 1 :]:
                        if isinstance(t, sqlparse.sql.Identifier):
                            table_name = t.get_real_name()
                            if real_queries.get(table_name) is None:
                                real_queries[table_name] = 0
                            real_queries[table_name] += 1
                            break

    return real_queries
