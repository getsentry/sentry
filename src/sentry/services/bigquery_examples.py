"""
BigQuery Integration Examples for Sentry

This module provides comprehensive examples and documentation for using the BigQuery
integration with Sentry. It demonstrates how to set up authentication, configure
the service, and run common analytics queries.

Setup Instructions:
==================

1. Install Dependencies
   The google-cloud-bigquery dependency has been added to pyproject.toml.
   Run `pip install google-cloud-bigquery` or use your dependency manager.

2. Authentication Setup
   You have several options for authentication:

   Option A: Application Default Credentials (ADC)
   - Run `gcloud auth application-default login` if using gcloud CLI
   - Or set GOOGLE_APPLICATION_CREDENTIALS environment variable to point to service account JSON

   Option B: Service Account Key File
   - Download a service account JSON file from Google Cloud Console
   - Set the path in Sentry options: bigquery.credentials-path

   Option C: Environment Variables
   - Set GOOGLE_CLOUD_PROJECT to your project ID
   - Ensure your environment has appropriate Google Cloud credentials

3. Configuration
   Add these settings to your Sentry configuration:

   ```python
   # In your Sentry settings
   SENTRY_OPTIONS['bigquery.project-id'] = 'your-gcp-project-id'
   SENTRY_OPTIONS['bigquery.default-dataset'] = 'sentry_analytics'
   SENTRY_OPTIONS['bigquery.credentials-path'] = '/path/to/service-account.json'  # Optional
   SENTRY_OPTIONS['bigquery.enable-debug-logging'] = True  # For debugging
   ```

4. Permissions Required
   Your service account or user needs these BigQuery permissions:
   - bigquery.datasets.create
   - bigquery.datasets.get
   - bigquery.tables.create
   - bigquery.tables.get
   - bigquery.tables.getData
   - bigquery.jobs.create

Usage Examples:
==============
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sentry.services.bigquery import BigQueryService, get_bigquery_service
from sentry.services.bigquery_models import SENTRY_EVENT_SCHEMA
from sentry.services.bigquery_queries import SentryBigQueryAnalytics, setup_bigquery_tables

logger = logging.getLogger(__name__)


def example_1_basic_setup():
    """
    Example 1: Basic BigQuery service setup and connection testing.

    This example shows how to initialize the BigQuery service and test connectivity.
    """
    print("=== Example 1: Basic Setup ===")

    try:
        # Initialize the BigQuery service
        # This will use default configuration from Sentry options
        service = get_bigquery_service(debug=True)

        print(f"BigQuery service initialized for project: {service.project_id}")

        # Test the connection
        if service.test_connection():
            print("✅ BigQuery connection test successful!")
        else:
            print("❌ BigQuery connection test failed!")

        # List available datasets
        try:
            datasets = list(service.client.list_datasets())
            print(f"Available datasets: {[d.dataset_id for d in datasets]}")
        except Exception as e:
            print(f"Could not list datasets: {e}")

    except Exception as e:
        print(f"Error setting up BigQuery service: {e}")


def example_2_create_dataset_and_tables():
    """
    Example 2: Create a dataset and tables for Sentry data.

    This example shows how to set up the BigQuery infrastructure for storing Sentry data.
    """
    print("\n=== Example 2: Dataset and Table Creation ===")

    try:
        service = get_bigquery_service()

        # Create a dataset for Sentry data
        dataset_name = "sentry_analytics_example"
        print(f"Creating dataset: {dataset_name}")

        try:
            service.create_dataset(dataset_name, location="US")
            print(f"✅ Dataset {dataset_name} created successfully!")
        except Exception as e:
            print(f"Dataset creation failed (may already exist): {e}")

        # Set up predefined tables using the helper function
        print("Setting up BigQuery tables with Sentry schemas...")
        setup_bigquery_tables()
        print("✅ Tables created successfully!")

        # Get information about the dataset
        dataset_info = service.get_dataset_info(dataset_name)
        print(f"Dataset info: {dataset_info}")

    except Exception as e:
        print(f"Error creating dataset and tables: {e}")


def example_3_basic_queries():
    """
    Example 3: Execute basic SQL queries against BigQuery.

    This example demonstrates how to run custom SQL queries.
    """
    print("\n=== Example 3: Basic SQL Queries ===")

    try:
        service = get_bigquery_service()

        # Example 1: Simple query to check table existence
        query = """
        SELECT table_name, creation_time
        FROM `{project_id}.sentry_data.INFORMATION_SCHEMA.TABLES`
        WHERE table_type = 'BASE_TABLE'
        LIMIT 5
        """.format(
            project_id=service.project_id
        )

        print("Executing query to list tables...")
        results = service.execute_query(query)
        print(f"Found {len(results)} tables:")
        for result in results:
            print(f"  - {result['table_name']} (created: {result['creation_time']})")

        # Example 2: Query with parameters (safer for user input)
        parameterized_query = """
        SELECT COUNT(*) as row_count
        FROM `{project_id}.sentry_data.events`
        WHERE timestamp >= @start_time
        """.format(
            project_id=service.project_id
        )

        # Note: This would fail if the table doesn't exist, which is expected
        # In a real scenario, you'd have data in these tables

    except Exception as e:
        print(f"Query execution failed (expected if tables are empty): {e}")


def example_4_analytics_queries():
    """
    Example 4: Use the high-level analytics functions.

    This example shows how to use the SentryBigQueryAnalytics class for common queries.
    """
    print("\n=== Example 4: Analytics Queries ===")

    try:
        # Initialize the analytics service
        analytics = SentryBigQueryAnalytics()

        print("Running analytics examples...")

        # Example queries (these will fail if there's no data, which is expected)
        try:
            print("1. Getting error trends for last 7 days...")
            error_trends = analytics.get_error_trends(days=7)
            print(f"   Retrieved {len(error_trends)} data points")
        except Exception as e:
            print(f"   Error trends query failed (no data): {e}")

        try:
            print("2. Getting top errors...")
            top_errors = analytics.get_top_errors(limit=5)
            print(f"   Retrieved {len(top_errors)} top errors")
        except Exception as e:
            print(f"   Top errors query failed (no data): {e}")

        try:
            print("3. Getting performance summary...")
            performance = analytics.get_performance_summary(hours=24, limit=10)
            print(f"   Retrieved {len(performance)} performance records")
        except Exception as e:
            print(f"   Performance query failed (no data): {e}")

        print("Note: Query failures are expected when tables are empty")

    except Exception as e:
        print(f"Error running analytics queries: {e}")


def example_5_custom_analytics():
    """
    Example 5: Create custom analytics queries.

    This shows how to write your own queries for specific analytics needs.
    """
    print("\n=== Example 5: Custom Analytics ===")

    try:
        service = get_bigquery_service()

        # Custom query example: Error rate by hour for a specific day
        custom_query = """
        WITH hourly_stats AS (
            SELECT
                EXTRACT(HOUR FROM timestamp) as hour,
                COUNT(*) as total_events,
                COUNTIF(level IN ('error', 'fatal')) as error_events
            FROM `{project_id}.sentry_data.events`
            WHERE DATE(timestamp) = CURRENT_DATE()
            GROUP BY hour
        )
        SELECT
            hour,
            total_events,
            error_events,
            SAFE_DIVIDE(error_events, total_events) * 100 as error_rate_percent
        FROM hourly_stats
        ORDER BY hour
        """.format(
            project_id=service.project_id
        )

        print("Executing custom hourly error rate query...")
        try:
            results = service.execute_query(custom_query)
            print(f"Retrieved {len(results)} hourly statistics")

            if results:
                print("Hourly error rates:")
                for result in results:
                    print(
                        f"  Hour {result['hour']:2d}: {result['error_rate_percent']:.2f}% "
                        f"({result['error_events']}/{result['total_events']})"
                    )
        except Exception as e:
            print(f"Custom query failed (no data): {e}")

    except Exception as e:
        print(f"Error running custom analytics: {e}")


def example_6_data_export():
    """
    Example 6: Export query results to a new table.

    This shows how to save query results for further analysis or reporting.
    """
    print("\n=== Example 6: Data Export ===")

    try:
        service = get_bigquery_service()

        # Query to aggregate daily error statistics
        export_query = """
        SELECT
            DATE(timestamp) as date,
            environment,
            platform,
            COUNT(*) as total_events,
            COUNTIF(level IN ('error', 'fatal')) as error_events,
            COUNT(DISTINCT user_id) as affected_users
        FROM `{project_id}.sentry_data.events`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY date, environment, platform
        ORDER BY date DESC, error_events DESC
        """.format(
            project_id=service.project_id
        )

        print("Exporting aggregated data to new table...")
        try:
            service.export_query_to_table(
                query=export_query,
                destination_dataset="sentry_data",
                destination_table="daily_error_summary",
                write_disposition="WRITE_TRUNCATE",
            )
            print("✅ Data exported to daily_error_summary table!")
        except Exception as e:
            print(f"Export failed (no source data): {e}")

    except Exception as e:
        print(f"Error during data export: {e}")


def example_7_monitoring_and_alerting():
    """
    Example 7: Create queries for monitoring and alerting.

    This shows queries you might use for setting up monitoring dashboards or alerts.
    """
    print("\n=== Example 7: Monitoring Queries ===")

    try:
        service = get_bigquery_service()

        # Query 1: Current error rate (last hour)
        error_rate_query = """
        SELECT
            COUNTIF(level IN ('error', 'fatal')) as error_count,
            COUNT(*) as total_count,
            SAFE_DIVIDE(COUNTIF(level IN ('error', 'fatal')), COUNT(*)) * 100 as error_rate_percent
        FROM `{project_id}.sentry_data.events`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
        """.format(
            project_id=service.project_id
        )

        # Query 2: New error types in the last hour
        new_errors_query = """
        WITH recent_errors AS (
            SELECT DISTINCT exception_type
            FROM `{project_id}.sentry_data.events`
            WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                AND level IN ('error', 'fatal')
                AND exception_type IS NOT NULL
        ),
        historical_errors AS (
            SELECT DISTINCT exception_type
            FROM `{project_id}.sentry_data.events`
            WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
                AND timestamp < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                AND level IN ('error', 'fatal')
                AND exception_type IS NOT NULL
        )
        SELECT re.exception_type as new_error_type
        FROM recent_errors re
        LEFT JOIN historical_errors he ON re.exception_type = he.exception_type
        WHERE he.exception_type IS NULL
        """.format(
            project_id=service.project_id
        )

        print("Monitoring queries (would be used in alerting systems):")
        print("1. Current error rate query created")
        print("2. New error types detection query created")
        print("These queries could be scheduled to run every few minutes for monitoring")

    except Exception as e:
        print(f"Error creating monitoring queries: {e}")


def run_all_examples():
    """
    Run all BigQuery integration examples.

    This function demonstrates the complete BigQuery integration workflow.
    """
    print("🚀 Running BigQuery Integration Examples")
    print("=" * 50)

    try:
        # Run all examples in sequence
        example_1_basic_setup()
        example_2_create_dataset_and_tables()
        example_3_basic_queries()
        example_4_analytics_queries()
        example_5_custom_analytics()
        example_6_data_export()
        example_7_monitoring_and_alerting()

        print("\n" + "=" * 50)
        print("✅ All examples completed!")
        print("\nNext steps:")
        print("1. Set up data ingestion to populate the BigQuery tables")
        print("2. Create scheduled jobs to run analytics queries")
        print("3. Set up monitoring and alerting based on query results")
        print("4. Build dashboards using tools like Looker, Data Studio, or Grafana")

    except Exception as e:
        print(f"\n❌ Error running examples: {e}")


# Quick start function for testing
def quick_test():
    """
    Quick test function to verify BigQuery integration is working.

    Use this for a fast connectivity and basic functionality test.
    """
    print("🧪 Quick BigQuery Integration Test")
    print("-" * 30)

    try:
        # Test 1: Service initialization
        service = get_bigquery_service()
        print(f"✅ Service initialized (Project: {service.project_id})")

        # Test 2: Connection test
        if service.test_connection():
            print("✅ Connection test passed")
        else:
            print("❌ Connection test failed")
            return False

        # Test 3: List datasets
        datasets = list(service.client.list_datasets(max_results=5))
        print(f"✅ Can access datasets (found {len(datasets)})")

        # Test 4: Simple query
        test_query = "SELECT 1 as test_value, CURRENT_TIMESTAMP() as current_time"
        result = service.execute_query(test_query)
        if result and len(result) > 0:
            print(f"✅ Query execution works (result: {result[0]})")

        print("\n🎉 BigQuery integration is working correctly!")
        return True

    except Exception as e:
        print(f"❌ Quick test failed: {e}")
        return False


if __name__ == "__main__":
    # You can run this module directly to see the examples
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "quick":
        quick_test()
    else:
        run_all_examples()
