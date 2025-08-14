"""
BigQuery utility functions for Sentry.

Provides utilities for querying BigQuery tables for analytics and data exports.
"""

import logging
import os
from typing import Any, Dict, List, Optional

from google.cloud import bigquery
from google.cloud.exceptions import NotFound
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


class BigQueryClient:
    """
    A wrapper around Google Cloud BigQuery client with Sentry-specific configurations.
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        credentials_path: Optional[str] = None,
        location: str = "US",
    ):
        """
        Initialize BigQuery client.
        
        Args:
            project_id: GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.
            credentials_path: Path to service account JSON. Defaults to GOOGLE_APPLICATION_CREDENTIALS env var.
            location: BigQuery location for jobs. Defaults to "US".
        """
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT")
        self.location = location
        
        if not self.project_id:
            raise ValueError(
                "BigQuery project ID must be provided via project_id parameter "
                "or GOOGLE_CLOUD_PROJECT environment variable"
            )
        
        # Initialize credentials
        credentials = None
        if credentials_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred_path = credentials_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            credentials = service_account.Credentials.from_service_account_file(cred_path)
        
        # Initialize BigQuery client
        self.client = bigquery.Client(
            project=self.project_id,
            credentials=credentials,
            location=self.location
        )
        
        logger.info(f"Initialized BigQuery client for project: {self.project_id}")

    def query(
        self,
        sql: str,
        parameters: Optional[List[Any]] = None,
        job_config: Optional[bigquery.QueryJobConfig] = None,
        dry_run: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Execute a BigQuery SQL query and return results.
        
        Args:
            sql: SQL query string
            parameters: Optional query parameters for parameterized queries
            job_config: Optional BigQuery job configuration
            dry_run: If True, validate query without executing
            
        Returns:
            List of dictionaries representing query results
            
        Raises:
            Exception: If query execution fails
        """
        try:
            # Configure job
            if job_config is None:
                job_config = bigquery.QueryJobConfig()
            
            job_config.dry_run = dry_run
            
            if parameters:
                job_config.query_parameters = parameters
            
            logger.info(f"Executing BigQuery {'dry run' if dry_run else 'query'}: {sql[:200]}...")
            
            # Execute query
            query_job = self.client.query(sql, job_config=job_config)
            
            if dry_run:
                logger.info(f"Query is valid. Estimated bytes processed: {query_job.total_bytes_processed}")
                return []
            
            # Get results
            results = query_job.result()
            rows = [dict(row) for row in results]
            
            logger.info(f"Query completed. Returned {len(rows)} rows.")
            return rows
            
        except Exception as e:
            logger.error(f"BigQuery query failed: {str(e)}")
            raise

    def get_table_schema(self, dataset_id: str, table_id: str) -> List[Dict[str, Any]]:
        """
        Get the schema of a BigQuery table.
        
        Args:
            dataset_id: BigQuery dataset ID
            table_id: BigQuery table ID
            
        Returns:
            List of field schemas
        """
        try:
            table_ref = self.client.dataset(dataset_id).table(table_id)
            table = self.client.get_table(table_ref)
            
            schema = []
            for field in table.schema:
                schema.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description,
                })
            
            return schema
            
        except NotFound:
            logger.error(f"Table {dataset_id}.{table_id} not found")
            raise
        except Exception as e:
            logger.error(f"Failed to get table schema: {str(e)}")
            raise

    def list_datasets(self) -> List[str]:
        """
        List all datasets in the project.
        
        Returns:
            List of dataset IDs
        """
        try:
            datasets = list(self.client.list_datasets())
            return [dataset.dataset_id for dataset in datasets]
        except Exception as e:
            logger.error(f"Failed to list datasets: {str(e)}")
            raise

    def list_tables(self, dataset_id: str) -> List[str]:
        """
        List all tables in a dataset.
        
        Args:
            dataset_id: BigQuery dataset ID
            
        Returns:
            List of table IDs
        """
        try:
            dataset_ref = self.client.dataset(dataset_id)
            tables = list(self.client.list_tables(dataset_ref))
            return [table.table_id for table in tables]
        except Exception as e:
            logger.error(f"Failed to list tables in dataset {dataset_id}: {str(e)}")
            raise


def get_bigquery_client(**kwargs) -> BigQueryClient:
    """
    Factory function to create a BigQuery client with default Sentry configurations.
    
    Args:
        **kwargs: Additional arguments to pass to BigQueryClient constructor
        
    Returns:
        Configured BigQueryClient instance
    """
    return BigQueryClient(**kwargs)


# Common query templates for Sentry data analysis
class SentryQueries:
    """
    Collection of common BigQuery queries for Sentry data analysis.
    """
    
    @staticmethod
    def events_by_project(
        project_id: int, 
        start_date: str, 
        end_date: str, 
        dataset: str = "sentry_data"
    ) -> str:
        """
        Query events for a specific project within a date range.
        
        Args:
            project_id: Sentry project ID
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            dataset: BigQuery dataset containing Sentry data
            
        Returns:
            SQL query string
        """
        return f"""
        SELECT 
            event_id,
            timestamp,
            level,
            message,
            platform,
            sdk_name,
            sdk_version,
            user_id,
            tags,
            contexts
        FROM `{dataset}.events`
        WHERE project_id = {project_id}
        AND DATE(timestamp) BETWEEN '{start_date}' AND '{end_date}'
        ORDER BY timestamp DESC
        LIMIT 1000
        """
    
    @staticmethod
    def error_frequency_by_issue(
        project_id: int, 
        days: int = 7,
        dataset: str = "sentry_data"
    ) -> str:
        """
        Query error frequency by issue for the last N days.
        
        Args:
            project_id: Sentry project ID
            days: Number of days to look back
            dataset: BigQuery dataset containing Sentry data
            
        Returns:
            SQL query string
        """
        return f"""
        SELECT 
            issue_id,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as affected_users,
            MIN(timestamp) as first_seen,
            MAX(timestamp) as last_seen
        FROM `{dataset}.events`
        WHERE project_id = {project_id}
        AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY issue_id
        ORDER BY event_count DESC
        LIMIT 100
        """