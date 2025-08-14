from __future__ import annotations

from datetime import datetime
from typing import Any, TypedDict

from google.cloud import bigquery


class BigQueryQueryConfig(TypedDict):
    """Configuration for BigQuery query execution."""

    query: str
    parameters: list[bigquery.ScalarQueryParameter] | None
    timeout: int | None
    use_legacy_sql: bool
    dry_run: bool
    maximum_bytes_billed: int | None


class BigQueryTableReference(TypedDict):
    """Reference to a BigQuery table."""

    project_id: str
    dataset_id: str
    table_id: str


class BigQueryDatasetInfo(TypedDict):
    """Information about a BigQuery dataset."""

    dataset_id: str
    project: str
    created: datetime | None
    modified: datetime | None
    description: str | None
    location: str
    table_count: int


class BigQueryTableInfo(TypedDict):
    """Information about a BigQuery table."""

    table_id: str
    table_type: str
    created: datetime | None
    modified: datetime | None
    num_rows: int | None
    size_bytes: int | None


class BigQueryFieldSchema(TypedDict):
    """Schema information for a BigQuery table field."""

    name: str
    field_type: str
    mode: str
    description: str | None


class SentryEventData(TypedDict):
    """Schema for Sentry event data that could be stored in BigQuery."""

    event_id: str
    project_id: int
    organization_id: int
    timestamp: datetime
    platform: str | None
    environment: str | None
    release: str | None
    level: str
    message: str | None
    exception_type: str | None
    exception_value: str | None
    user_id: str | None
    user_email: str | None
    tags: dict[str, str]
    extra: dict[str, Any]
    fingerprint: list[str]
    grouping_config: str | None


class SentryPerformanceData(TypedDict):
    """Schema for Sentry performance/transaction data."""

    event_id: str
    project_id: int
    organization_id: int
    timestamp: datetime
    transaction_name: str
    op: str
    duration_ms: float
    platform: str | None
    environment: str | None
    release: str | None
    user_id: str | None
    tags: dict[str, str]
    measurements: dict[str, float]
    contexts: dict[str, Any]


class SentryIssueData(TypedDict):
    """Schema for Sentry issue/group data."""

    issue_id: int
    project_id: int
    organization_id: int
    first_seen: datetime
    last_seen: datetime
    times_seen: int
    priority: int | None
    level: str
    status: str
    title: str
    culprit: str | None
    type: str
    metadata: dict[str, Any]
    platform: str | None


# Common BigQuery schemas for Sentry data
SENTRY_EVENT_SCHEMA = [
    bigquery.SchemaField("event_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("project_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("organization_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
    bigquery.SchemaField("platform", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("environment", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("release", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("level", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("message", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("exception_type", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("exception_value", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("user_id", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("user_email", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("tags", "JSON", mode="NULLABLE"),
    bigquery.SchemaField("extra", "JSON", mode="NULLABLE"),
    bigquery.SchemaField("fingerprint", "STRING", mode="REPEATED"),
    bigquery.SchemaField("grouping_config", "STRING", mode="NULLABLE"),
]

SENTRY_PERFORMANCE_SCHEMA = [
    bigquery.SchemaField("event_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("project_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("organization_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
    bigquery.SchemaField("transaction_name", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("op", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("duration_ms", "FLOAT", mode="REQUIRED"),
    bigquery.SchemaField("platform", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("environment", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("release", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("user_id", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("tags", "JSON", mode="NULLABLE"),
    bigquery.SchemaField("measurements", "JSON", mode="NULLABLE"),
    bigquery.SchemaField("contexts", "JSON", mode="NULLABLE"),
]

SENTRY_ISSUE_SCHEMA = [
    bigquery.SchemaField("issue_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("project_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("organization_id", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("first_seen", "TIMESTAMP", mode="REQUIRED"),
    bigquery.SchemaField("last_seen", "TIMESTAMP", mode="REQUIRED"),
    bigquery.SchemaField("times_seen", "INTEGER", mode="REQUIRED"),
    bigquery.SchemaField("priority", "INTEGER", mode="NULLABLE"),
    bigquery.SchemaField("level", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("title", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("culprit", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("type", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("metadata", "JSON", mode="NULLABLE"),
    bigquery.SchemaField("platform", "STRING", mode="NULLABLE"),
]


class BigQuerySchemaHelper:
    """Helper class for working with BigQuery schemas."""

    @staticmethod
    def create_table_with_schema(
        client: bigquery.Client,
        table_ref: BigQueryTableReference,
        schema: list[bigquery.SchemaField],
        description: str | None = None,
    ) -> bigquery.Table:
        """Create a table with the specified schema."""
        full_table_id = (
            f"{table_ref['project_id']}.{table_ref['dataset_id']}.{table_ref['table_id']}"
        )
        table = bigquery.Table(full_table_id, schema=schema)

        if description:
            table.description = description

        return client.create_table(table)

    @staticmethod
    def validate_schema_compatibility(
        existing_schema: list[bigquery.SchemaField],
        new_schema: list[bigquery.SchemaField],
    ) -> bool:
        """Check if new schema is compatible with existing schema."""
        existing_fields = {field.name: field for field in existing_schema}

        for new_field in new_schema:
            if new_field.name in existing_fields:
                existing_field = existing_fields[new_field.name]
                if (
                    existing_field.field_type != new_field.field_type
                    or existing_field.mode != new_field.mode
                ):
                    return False

        return True

    @staticmethod
    def schema_to_dict(schema: list[bigquery.SchemaField]) -> list[dict[str, Any]]:
        """Convert schema fields to dictionary format."""
        return [
            {
                "name": field.name,
                "type": field.field_type,
                "mode": field.mode,
                "description": field.description,
            }
            for field in schema
        ]


# Example query templates for common Sentry analytics
COMMON_QUERIES = {
    "error_trends": """
        SELECT
            DATE(timestamp) as date,
            COUNT(*) as error_count,
            COUNT(DISTINCT user_id) as affected_users
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
            AND level IN ('error', 'fatal')
        GROUP BY date
        ORDER BY date DESC
    """,
    "top_errors": """
        SELECT
            exception_type,
            exception_value,
            COUNT(*) as occurrence_count,
            COUNT(DISTINCT user_id) as affected_users
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
            AND level IN ('error', 'fatal')
        GROUP BY exception_type, exception_value
        ORDER BY occurrence_count DESC
        LIMIT 10
    """,
    "performance_summary": """
        SELECT
            transaction_name,
            AVG(duration_ms) as avg_duration,
            PERCENTILE_CONT(duration_ms, 0.5) OVER() as p50_duration,
            PERCENTILE_CONT(duration_ms, 0.95) OVER() as p95_duration,
            COUNT(*) as transaction_count
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
        GROUP BY transaction_name
        ORDER BY avg_duration DESC
        LIMIT 20
    """,
    "user_impact": """
        SELECT
            user_id,
            user_email,
            COUNT(*) as error_count,
            MIN(timestamp) as first_error,
            MAX(timestamp) as last_error
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
            AND level IN ('error', 'fatal')
            AND user_id IS NOT NULL
        GROUP BY user_id, user_email
        ORDER BY error_count DESC
        LIMIT 50
    """,
}
