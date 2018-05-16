from __future__ import absolute_import

import sqlparse
import re
import ast

from sqlparse.tokens import DML


__all__ = ('parse_queries', )


def parse_queries(captured_queries):
    write_ops = ['INSERT', 'UPDATE', 'DELETE']

    real_queries = {}

    for query in captured_queries:
        match = re.search(r"QUERY = (.+) - PARAMS", query['sql'])
        if match:
            parsed = sqlparse.parse(ast.literal_eval(match.group(1)))
            for token in parsed[0].tokens:
                if token.ttype is DML:
                    if token.value.upper() in write_ops:
                        if real_queries.get(parsed[0].get_name()) is None:
                            real_queries[parsed[0].get_name()] = 0
                        real_queries[parsed[0].get_name()] += 1

    return real_queries
