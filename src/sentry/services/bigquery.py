from __future__ import annotations

import logging
import os
from typing import Any

from google.auth import default
from google.cloud import bigquery
from google.cloud.exceptions import GoogleCloudError

from sentry import options
from sentry.services.base import Service

logger = logging.getLogger(__name__)


class BigQueryService(Service):
    """
    Service for communicating with Google BigQuery to pull and analyze data.

    This service handles authentication, connection management, and provides
    methods for querying BigQuery datasets.
    """

    name = "bigquery"

    def __init__(
        self,
        project_id: str | None = None,
        credentials_path: str | None = None,
        debug: bool = False,
    ) -> None:
        super().__init__(debug=debug)

        self.project_id = project_id or self._get_project_id()
        self.credentials_path = credentials_path
        self._client: bigquery.Client | None = None

        if debug:
            logger.setLevel(logging.DEBUG)

    def _get_project_id(self) -> str:
        """Get the Google Cloud project ID from various sources."""
        # Try to get from Sentry options first
        project_id = options.get("bigquery.project-id")
        if project_id:
            return project_id

        # Try environment variable
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
        if project_id:
            return project_id

        # Try default credentials
        try:
            _, project_id = default()
            if project_id:
                return project_id
        except Exception as e:
            logger.warning(f"Could not get default project ID: {e}")

        raise ValueError(
            "BigQuery project ID not found. Please set 'bigquery.project-id' option, "
            "GOOGLE_CLOUD_PROJECT environment variable, or configure default credentials."
        )

    @property
    def client(self) -> bigquery.Client:
        """Get or create a BigQuery client instance."""
        if self._client is None:
            try:
                if self.credentials_path:
                    # Use service account credentials if provided
                    self._client = bigquery.Client.from_service_account_json(
                        self.credentials_path, project=self.project_id
                    )
                    logger.info(
                        f"BigQuery client initialized with service account: {self.credentials_path}"
                    )
                else:
                    # Use default credentials (ADC)
                    self._client = bigquery.Client(project=self.project_id)
                    logger.info(
                        f"BigQuery client initialized with default credentials for project: {self.project_id}"
                    )
            except Exception as e:
                logger.error(f"Failed to initialize BigQuery client: {e}")
                raise

        return self._client

    def test_connection(self) -> bool:
        """Test the BigQuery connection by listing datasets."""
        try:
            datasets = list(self.client.list_datasets(max_results=1))
            logger.info("BigQuery connection test successful")
            return True
        except GoogleCloudError as e:
            logger.error(f"BigQuery connection test failed: {e}")
            return False

    def execute_query(
        self,
        query: str,
        parameters: list[bigquery.ScalarQueryParameter] | None = None,
        job_config: bigquery.QueryJobConfig | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute a BigQuery SQL query and return results as a list of dictionaries.

        Args:
            query: SQL query string
            parameters: Optional query parameters for parameterized queries
            job_config: Optional job configuration

        Returns:
            List of dictionaries representing query results
        """
        try:
            if job_config is None:
                job_config = bigquery.QueryJobConfig()

            if parameters:
                job_config.query_parameters = parameters

            logger.debug(f"Executing BigQuery query: {query}")

            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            # Convert results to list of dictionaries
            rows = []
            for row in results:
                rows.append(dict(row))

            logger.info(f"Query executed successfully, returned {len(rows)} rows")
            return rows

        except GoogleCloudError as e:
            logger.error(f"BigQuery query failed: {e}")
            raise

    def get_dataset_info(self, dataset_id: str) -> dict[str, Any]:
        """Get information about a specific dataset."""
        try:
            dataset_ref = self.client.dataset(dataset_id)
            dataset = self.client.get_dataset(dataset_ref)

            return {
                "dataset_id": dataset.dataset_id,
                "project": dataset.project,
                "created": dataset.created,
                "modified": dataset.modified,
                "description": dataset.description,
                "location": dataset.location,
                "table_count": len(list(self.client.list_tables(dataset))),
            }
        except GoogleCloudError as e:
            logger.error(f"Failed to get dataset info for {dataset_id}: {e}")
            raise

    def list_tables(self, dataset_id: str) -> list[dict[str, Any]]:
        """List all tables in a dataset."""
        try:
            dataset_ref = self.client.dataset(dataset_id)
            tables = self.client.list_tables(dataset_ref)

            table_list = []
            for table in tables:
                table_info = {
                    "table_id": table.table_id,
                    "table_type": table.table_type,
                    "created": table.created,
                    "modified": table.modified,
                }
                table_list.append(table_info)

            return table_list
        except GoogleCloudError as e:
            logger.error(f"Failed to list tables for dataset {dataset_id}: {e}")
            raise

    def get_table_schema(self, dataset_id: str, table_id: str) -> list[dict[str, Any]]:
        """Get the schema of a specific table."""
        try:
            table_ref = self.client.dataset(dataset_id).table(table_id)
            table = self.client.get_table(table_ref)

            schema = []
            for field in table.schema:
                schema.append(
                    {
                        "name": field.name,
                        "field_type": field.field_type,
                        "mode": field.mode,
                        "description": field.description,
                    }
                )

            return schema
        except GoogleCloudError as e:
            logger.error(f"Failed to get schema for table {dataset_id}.{table_id}: {e}")
            raise

    def create_dataset(self, dataset_id: str, location: str = "US") -> None:
        """Create a new dataset."""
        try:
            dataset = bigquery.Dataset(f"{self.project_id}.{dataset_id}")
            dataset.location = location

            self.client.create_dataset(dataset)
            logger.info(f"Created dataset {dataset_id} in {location}")
        except GoogleCloudError as e:
            logger.error(f"Failed to create dataset {dataset_id}: {e}")
            raise

    def export_query_to_table(
        self,
        query: str,
        destination_dataset: str,
        destination_table: str,
        write_disposition: str = "WRITE_TRUNCATE",
    ) -> None:
        """
        Export query results to a BigQuery table.

        Args:
            query: SQL query to execute
            destination_dataset: Target dataset ID
            destination_table: Target table ID
            write_disposition: How to write data (WRITE_TRUNCATE, WRITE_APPEND, WRITE_EMPTY)
        """
        try:
            job_config = bigquery.QueryJobConfig(
                destination=f"{self.project_id}.{destination_dataset}.{destination_table}",
                write_disposition=write_disposition,
            )

            query_job = self.client.query(query, job_config=job_config)
            query_job.result()  # Wait for the job to complete

            logger.info(f"Query results exported to {destination_dataset}.{destination_table}")
        except GoogleCloudError as e:
            logger.error(f"Failed to export query to table: {e}")
            raise


# Convenience function to get a BigQuery service instance
def get_bigquery_service(
    project_id: str | None = None,
    credentials_path: str | None = None,
    debug: bool = False,
) -> BigQueryService:
    """
    Factory function to create a BigQuery service instance.

    Args:
        project_id: Google Cloud project ID (optional)
        credentials_path: Path to service account JSON file (optional)
        debug: Enable debug logging

    Returns:
        BigQueryService instance
    """
    return BigQueryService(
        project_id=project_id,
        credentials_path=credentials_path,
        debug=debug,
    )
