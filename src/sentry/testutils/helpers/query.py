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
        raw_sql = query['sql']
        match = re.search(r"QUERY = (.+) - PARAMS", query['sql'])
        if match:  # this is a sqlite query
            raw_sql = ast.literal_eval(match.group(1))
        parsed = sqlparse.parse(raw_sql)
        for token in parsed[0].tokens:
            if token.ttype is DML:
                if token.value.upper() in write_ops:
                    table_name = parsed[0].get_real_name()
                    if parsed[0].get_real_name() == "*":  # DELETE * FROM ...
                        table_name = parsed[0].get_name()
                    # there is ` in mysql queries
                    table_name = table_name.replace('`', '')
                    if real_queries.get(table_name) is None:
                        real_queries[table_name] = 0
                    real_queries[table_name] += 1

    return real_queries
