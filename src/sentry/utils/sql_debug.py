"""
SQL debugging utilities for development and testing.
"""

import os
import time
from collections.abc import Generator
from contextlib import contextmanager

from django.db import connections

# Global storage for captured queries across all debuggers
_global_captured_queries = []


class SQLDebugger:
    """Utility class for capturing and analyzing SQL queries."""

    def __init__(self):
        self.captured_queries: list[dict] = []
        self.connections_backup: dict = {}
        self.execute_wrappers: dict = {}

    def start_capture(self):
        """Start capturing SQL queries including raw SQL from bulk operations."""
        global _global_captured_queries
        _global_captured_queries = []

        # Capture the current state and reset query logging for all connections
        for conn in connections.all():
            # Store the current queries to avoid losing them
            self.connections_backup[conn.alias] = {
                "existing_queries": list(conn.queries),
                "force_debug_cursor": conn.force_debug_cursor,
            }

            # Enable debug mode and clear current queries to start fresh
            conn.force_debug_cursor = True
            conn.queries.clear()

            # Add execute wrapper to catch ALL SQL operations, including raw ones
            wrapper = self._create_execute_wrapper(conn.alias)
            self.execute_wrappers[conn.alias] = wrapper
            conn.execute_wrappers.append(wrapper)

    def _create_execute_wrapper(self, connection_alias: str):
        """Create an execute wrapper that captures all SQL operations."""

        def execute_wrapper(execute, sql, params, many, context):
            # Record the start time
            start_time = time.time()

            try:
                # Execute the SQL
                result = execute(sql, params, many, context)

                # Calculate execution time
                execution_time = time.time() - start_time

                # Store the query info
                query_info = {
                    "sql": sql,
                    "time": f"{execution_time:.6f}",
                    "connection": connection_alias,
                    "params": params,
                    "many": many,
                }

                _global_captured_queries.append(query_info)

                return result

            except Exception as e:
                # Still record failed queries
                execution_time = time.time() - start_time
                query_info = {
                    "sql": sql,
                    "time": f"{execution_time:.6f}",
                    "connection": connection_alias,
                    "params": params,
                    "many": many,
                    "error": str(e),
                }
                _global_captured_queries.append(query_info)
                raise

        return execute_wrapper

    def stop_capture(self):
        """Stop capturing SQL queries and collect them."""
        global _global_captured_queries

        # Remove execute wrappers and restore original state
        for conn in connections.all():
            if conn.alias in self.connections_backup:
                # Remove our execute wrapper
                if conn.alias in self.execute_wrappers:
                    wrapper = self.execute_wrappers[conn.alias]
                    if wrapper in conn.execute_wrappers:
                        conn.execute_wrappers.remove(wrapper)

                # Restore the original state
                backup = self.connections_backup[conn.alias]
                conn.force_debug_cursor = backup["force_debug_cursor"]

        # Get all captured queries
        self.captured_queries = list(_global_captured_queries)
        _global_captured_queries = []  # Clear global state

        return self.captured_queries

    def analyze_queries(self, filter_tables: list[str] | None = None) -> dict:
        """Analyze captured queries and return statistics."""
        if not self.captured_queries:
            return {}

        analysis: dict = {
            "total_queries": len(self.captured_queries),
            "query_types": {},
            "tables_affected": {},
            "queries_by_table": {},
        }

        for query in self.captured_queries:
            sql = query["sql"].upper()

            # Determine query type
            if sql.startswith("SELECT"):
                query_type = "SELECT"
            elif sql.startswith("INSERT"):
                query_type = "INSERT"
            elif sql.startswith("UPDATE"):
                query_type = "UPDATE"
            elif sql.startswith("DELETE"):
                query_type = "DELETE"
            else:
                query_type = "OTHER"

            analysis["query_types"][query_type] = analysis["query_types"].get(query_type, 0) + 1

            # Extract table names if filter_tables provided
            if filter_tables:
                for table in filter_tables:
                    if table.lower() in query["sql"].lower():
                        if table not in analysis["tables_affected"]:
                            analysis["tables_affected"][table] = 0
                            analysis["queries_by_table"][table] = []
                        analysis["tables_affected"][table] += 1
                        analysis["queries_by_table"][table].append(query["sql"])

        return analysis


@contextmanager
def sql_debug_context(
    enable_debug: bool = False,
    filter_tables: list[str] | None = None,
) -> Generator[SQLDebugger]:
    """Context manager for SQL debugging.

    Args:
        enable_debug: Whether to enable debugging. If None, checks SENTRY_DEBUG_SQL env var.
        filter_tables: List of table names to filter queries by.

    Example:
        with sql_debug_context(enable_debug=True, filter_tables=['sentry_grouphash']) as debugger:
            # Your code here
            pass
        # Later inspect: debugger.analyze_queries()
    """
    if not enable_debug:
        enable_debug = bool(os.environ.get("SENTRY_DEBUG_SQL"))

    debugger = SQLDebugger()

    if enable_debug:
        debugger.start_capture()

    try:
        yield debugger
    finally:
        if enable_debug:
            debugger.stop_capture()
