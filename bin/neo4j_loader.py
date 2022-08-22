import os
import binascii
import uuid
import random
import sys

from neo4j import GraphDatabase

projects = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]


class SpanLoader:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.span_ids = set()

    def close(self):
        self.driver.close()

    def generate_trace_id(self):
        return str(uuid.uuid4()).replace("-", "")

    def generate_span_id(self):
        val = binascii.b2a_hex(os.urandom(8))
        while val in self.span_ids:
            val = binascii.b2a_hex(os.urandom(8))

        self.span_ids.add(val)
        return val.decode("ascii")

    def generate_transaction_id(self, project_id):
        num = random.randint(0, 100)
        return f"{project_id}/{num}"

    def build_transaction(self, max_levels, level=0, parent_span_id=None):
        if level == max_levels:
            return [], [], {}

        span_id = self.generate_span_id()
        project_id = projects[level]
        span_ids, queries, params = [span_id], [], {}
        params.update(
            {
                f"span_id_{span_id}": span_id,
                f"timestamp_{span_id}": 1661187629.28002,
                f"start_timestamp_{span_id}": 1661187628.771846,
                f"project_{span_id}": project_id,
                f"transaction_{span_id}": self.generate_transaction_id(project_id),
            }
        )
        parent_query_insert = ""
        if parent_span_id:
            params[f"parent_span_id_{span_id}"] = parent_span_id
            parent_query_insert = f", parent_span_id: $parent_span_id_{span_id}"

        queries.append(
            f"CREATE (span_{span_id}:Span:Transaction {{trace_id: $trace_id, span_id: $span_id_{span_id}, timestamp: $timestamp_{span_id}, start_timestamp: $start_timestamp_{span_id}, project: $project_{span_id}, transaction: $transaction_{span_id}{parent_query_insert}}})"
        )
        if parent_span_id is not None:
            queries.append(f"CREATE (span_{parent_span_id})-[:PARENT_OF]->(span_{span_id})")

        # if levels > 0, create children transactions
        num_child_spans = max(5 - (max_levels - level), 0)
        if num_child_spans > 0:
            child_spans, child_queries, child_params = self.build_child_spans(
                span_id, num_child_spans
            )
            span_ids.extend(child_spans)
            queries.extend(child_queries)
            params.update(child_params)

        for i in range(max_levels - level):
            # build children transactions
            cs_span_ids, cs_queries, cs_params = self.build_transaction(
                max_levels, level + 1, span_id
            )
            span_ids.extend(cs_span_ids)
            queries.extend(cs_queries)
            params.update(cs_params)

        return span_ids, queries, params

    def build_child_spans(self, parent_span_id, num):
        span_ids, queries, params = [], [], {}

        for _ in range(num):
            span_id = self.generate_span_id()
            span_ids.append(span_id)
            params.update(
                {
                    f"span_id_{span_id}": span_id,
                    f"timestamp_{span_id}": 1661187629.28002,
                    f"start_timestamp_{span_id}": 1661187628.771846,
                    f"parent_span_id_{span_id}": parent_span_id,
                }
            )
            queries.append(
                f"CREATE (span_{span_id}:Span {{trace_id: $trace_id, span_id: $span_id_{span_id}, timestamp: $timestamp_{span_id}, start_timestamp: $start_timestamp_{span_id}, parent_span_id: $parent_span_id_{span_id}}})"
            )
            queries.append(f"CREATE (span_{parent_span_id})-[:PARENT_OF]->(span_{span_id})")

        return span_ids, queries, params

    def create_trace(self, levels):
        span_ids, queries, params = self.build_transaction(levels)
        params["trace_id"] = self.generate_trace_id()
        queries.append(f"RETURN span_{span_ids[0]}")
        created = self.run_queries(queries, params)
        print("ROOT", created)

    def run_queries(self, queries, params):
        with self.driver.session() as session:
            query = "\n".join(queries)
            val = session.write_transaction(self._run_query, query, params)

        return val

    @staticmethod
    def _run_query(tx, query, params):
        result = tx.run(query, **params)
        return result.single()[0]


levels = int(sys.argv[1])
loader = SpanLoader("bolt://localhost:7687", "neo4j", "password")
loader.create_trace(levels)
loader.close()
