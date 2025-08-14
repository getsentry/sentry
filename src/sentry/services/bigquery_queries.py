from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from google.cloud import bigquery

from sentry import options
from sentry.services.bigquery import BigQueryService, get_bigquery_service
from sentry.services.bigquery_models import (
    COMMON_QUERIES,
    BigQueryTableReference,
    SentryEventData,
    SentryIssueData,
    SentryPerformanceData,
)

logger = logging.getLogger(__name__)


class SentryBigQueryAnalytics:
    """
    High-level analytics functions for querying Sentry data in BigQuery.

    This class provides easy-to-use methods for common analytics queries
    that Sentry users would want to run on their data.
    """

    def __init__(
        self,
        service: BigQueryService | None = None,
        default_dataset: str | None = None,
    ) -> None:
        self.service = service or get_bigquery_service()
        self.default_dataset = (
            default_dataset or options.get("bigquery.default-dataset") or "sentry_data"
        )

    def get_error_trends(
        self,
        project_id: int | None = None,
        days: int = 30,
        table_name: str = "events",
    ) -> list[dict[str, Any]]:
        """
        Get error trends over the specified number of days.

        Args:
            project_id: Optional Sentry project ID to filter by
            days: Number of days to look back
            table_name: Name of the events table

        Returns:
            List of dictionaries with date, error_count, and affected_users
        """
        query = """
        SELECT
            DATE(timestamp) as date,
            COUNT(*) as error_count,
            COUNT(DISTINCT user_id) as affected_users
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
            AND level IN ('error', 'fatal')
            {project_filter}
        GROUP BY date
        ORDER BY date DESC
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            days=days,
            project_filter=project_filter,
        )

        return self.service.execute_query(formatted_query)

    def get_top_errors(
        self,
        project_id: int | None = None,
        days: int = 7,
        limit: int = 10,
        table_name: str = "events",
    ) -> list[dict[str, Any]]:
        """
        Get the top errors by occurrence count.

        Args:
            project_id: Optional Sentry project ID to filter by
            days: Number of days to look back
            limit: Maximum number of results to return
            table_name: Name of the events table

        Returns:
            List of dictionaries with error details and counts
        """
        query = """
        SELECT
            exception_type,
            exception_value,
            COUNT(*) as occurrence_count,
            COUNT(DISTINCT user_id) as affected_users,
            MAX(timestamp) as last_seen,
            MIN(timestamp) as first_seen
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
            AND level IN ('error', 'fatal')
            AND exception_type IS NOT NULL
            {project_filter}
        GROUP BY exception_type, exception_value
        ORDER BY occurrence_count DESC
        LIMIT {limit}
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            days=days,
            limit=limit,
            project_filter=project_filter,
        )

        return self.service.execute_query(formatted_query)

    def get_performance_summary(
        self,
        project_id: int | None = None,
        hours: int = 24,
        limit: int = 20,
        table_name: str = "transactions",
    ) -> list[dict[str, Any]]:
        """
        Get performance summary for transactions.

        Args:
            project_id: Optional Sentry project ID to filter by
            hours: Number of hours to look back
            limit: Maximum number of results to return
            table_name: Name of the transactions table

        Returns:
            List of dictionaries with transaction performance metrics
        """
        query = """
        SELECT
            transaction_name,
            COUNT(*) as transaction_count,
            AVG(duration_ms) as avg_duration,
            PERCENTILE_CONT(duration_ms, 0.5) OVER(PARTITION BY transaction_name) as p50_duration,
            PERCENTILE_CONT(duration_ms, 0.95) OVER(PARTITION BY transaction_name) as p95_duration,
            MAX(duration_ms) as max_duration,
            MIN(duration_ms) as min_duration
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {hours} HOUR)
            {project_filter}
        GROUP BY transaction_name
        ORDER BY avg_duration DESC
        LIMIT {limit}
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            hours=hours,
            limit=limit,
            project_filter=project_filter,
        )

        return self.service.execute_query(formatted_query)

    def get_user_impact_analysis(
        self,
        project_id: int | None = None,
        days: int = 7,
        limit: int = 50,
        table_name: str = "events",
    ) -> list[dict[str, Any]]:
        """
        Analyze which users are most impacted by errors.

        Args:
            project_id: Optional Sentry project ID to filter by
            days: Number of days to look back
            limit: Maximum number of results to return
            table_name: Name of the events table

        Returns:
            List of dictionaries with user impact data
        """
        query = """
        SELECT
            user_id,
            user_email,
            COUNT(*) as error_count,
            COUNT(DISTINCT exception_type) as unique_error_types,
            MIN(timestamp) as first_error,
            MAX(timestamp) as last_error,
            STRING_AGG(DISTINCT environment, ', ') as environments,
            STRING_AGG(DISTINCT platform, ', ') as platforms
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
            AND level IN ('error', 'fatal')
            AND user_id IS NOT NULL
            {project_filter}
        GROUP BY user_id, user_email
        ORDER BY error_count DESC
        LIMIT {limit}
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            days=days,
            limit=limit,
            project_filter=project_filter,
        )

        return self.service.execute_query(formatted_query)

    def get_release_comparison(
        self,
        release_1: str,
        release_2: str,
        project_id: int | None = None,
        table_name: str = "events",
    ) -> dict[str, Any]:
        """
        Compare error rates and types between two releases.

        Args:
            release_1: First release version to compare
            release_2: Second release version to compare
            project_id: Optional Sentry project ID to filter by
            table_name: Name of the events table

        Returns:
            Dictionary with comparison data
        """
        query = """
        WITH release_stats AS (
            SELECT
                release,
                COUNT(*) as total_events,
                COUNTIF(level IN ('error', 'fatal')) as error_events,
                COUNT(DISTINCT user_id) as affected_users,
                COUNT(DISTINCT exception_type) as unique_error_types
            FROM `{project_id}.{dataset_id}.{table_id}`
            WHERE release IN ('{release_1}', '{release_2}')
                {project_filter}
            GROUP BY release
        )
        SELECT
            release,
            total_events,
            error_events,
            affected_users,
            unique_error_types,
            SAFE_DIVIDE(error_events, total_events) * 100 as error_rate_percent
        FROM release_stats
        ORDER BY release
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            release_1=release_1,
            release_2=release_2,
            project_filter=project_filter,
        )

        results = self.service.execute_query(formatted_query)

        # Format the results into a comparison structure
        comparison = {"release_1": None, "release_2": None}
        for result in results:
            if result["release"] == release_1:
                comparison["release_1"] = result
            elif result["release"] == release_2:
                comparison["release_2"] = result

        return comparison

    def get_environment_health(
        self,
        project_id: int | None = None,
        hours: int = 24,
        table_name: str = "events",
    ) -> list[dict[str, Any]]:
        """
        Get health metrics for different environments.

        Args:
            project_id: Optional Sentry project ID to filter by
            hours: Number of hours to look back
            table_name: Name of the events table

        Returns:
            List of dictionaries with environment health data
        """
        query = """
        SELECT
            environment,
            COUNT(*) as total_events,
            COUNTIF(level IN ('error', 'fatal')) as error_events,
            COUNTIF(level = 'warning') as warning_events,
            COUNTIF(level = 'info') as info_events,
            COUNT(DISTINCT user_id) as active_users,
            SAFE_DIVIDE(COUNTIF(level IN ('error', 'fatal')), COUNT(*)) * 100 as error_rate_percent
        FROM `{project_id}.{dataset_id}.{table_id}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {hours} HOUR)
            AND environment IS NOT NULL
            {project_filter}
        GROUP BY environment
        ORDER BY error_rate_percent DESC, total_events DESC
        """

        project_filter = f"AND project_id = {project_id}" if project_id else ""

        formatted_query = query.format(
            project_id=self.service.project_id,
            dataset_id=self.default_dataset,
            table_id=table_name,
            hours=hours,
            project_filter=project_filter,
        )

        return self.service.execute_query(formatted_query)


# Example functions for data export and management
def export_sentry_events_to_bigquery(
    start_date: datetime,
    end_date: datetime,
    project_id: int,
    destination_table: str = "sentry_events_export",
) -> None:
    """
    Example function to export Sentry events to BigQuery.

    This would typically be called by a scheduled task or manual process
    to export Sentry data for analytics.
    """
    service = get_bigquery_service()

    # This is a placeholder - in real implementation, you would:
    # 1. Connect to Sentry's database
    # 2. Query events for the date range
    # 3. Transform the data to match BigQuery schema
    # 4. Insert into BigQuery table

    logger.info(f"Exporting Sentry events from {start_date} to {end_date} for project {project_id}")

    # Example of creating a table if it doesn't exist
    try:
        dataset_id = options.get("bigquery.default-dataset") or "sentry_data"
        service.create_dataset(dataset_id)
        logger.info(f"Dataset {dataset_id} created or already exists")
    except Exception as e:
        logger.error(f"Failed to create dataset: {e}")


def setup_bigquery_tables() -> None:
    """
    Set up the BigQuery tables with proper schemas for Sentry data.

    This function creates the necessary tables with predefined schemas.
    """
    from sentry.services.bigquery_models import (
        SENTRY_EVENT_SCHEMA,
        SENTRY_ISSUE_SCHEMA,
        SENTRY_PERFORMANCE_SCHEMA,
        BigQuerySchemaHelper,
    )

    service = get_bigquery_service()
    dataset_id = options.get("bigquery.default-dataset") or "sentry_data"

    tables_to_create = [
        ("events", SENTRY_EVENT_SCHEMA, "Sentry error and event data"),
        ("transactions", SENTRY_PERFORMANCE_SCHEMA, "Sentry performance/transaction data"),
        ("issues", SENTRY_ISSUE_SCHEMA, "Sentry issue/group data"),
    ]

    for table_name, schema, description in tables_to_create:
        try:
            table_ref = {
                "project_id": service.project_id,
                "dataset_id": dataset_id,
                "table_id": table_name,
            }

            table = BigQuerySchemaHelper.create_table_with_schema(
                service.client,
                table_ref,
                schema,
                description,
            )

            logger.info(f"Created table {table_name} in dataset {dataset_id}")
        except Exception as e:
            logger.error(f"Failed to create table {table_name}: {e}")


# Example usage function
def run_analytics_examples() -> dict[str, Any]:
    """
    Run example analytics queries and return results.

    This demonstrates how to use the BigQuery analytics functions.
    """
    analytics = SentryBigQueryAnalytics()

    results = {}

    try:
        # Get error trends for the last 7 days
        results["error_trends"] = analytics.get_error_trends(days=7)
        logger.info(f"Retrieved {len(results['error_trends'])} days of error trends")

        # Get top 5 errors
        results["top_errors"] = analytics.get_top_errors(limit=5)
        logger.info(f"Retrieved {len(results['top_errors'])} top errors")

        # Get performance summary for last 12 hours
        results["performance"] = analytics.get_performance_summary(hours=12, limit=10)
        logger.info(f"Retrieved {len(results['performance'])} transaction summaries")

        # Get user impact analysis
        results["user_impact"] = analytics.get_user_impact_analysis(limit=25)
        logger.info(f"Retrieved {len(results['user_impact'])} user impact records")

        # Get environment health
        results["environment_health"] = analytics.get_environment_health()
        logger.info(f"Retrieved {len(results['environment_health'])} environment health records")

    except Exception as e:
        logger.error(f"Error running analytics examples: {e}")
        results["error"] = str(e)

    return results
