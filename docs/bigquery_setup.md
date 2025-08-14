# BigQuery Integration for Sentry

This guide explains how to set up and use BigQuery for querying Sentry data and external datasets.

## Setup

### 1. Install Dependencies

The BigQuery client library has already been added to `pyproject.toml`. Install it by running:

```bash
pip install google-cloud-bigquery
```

### 2. Authentication

You need to authenticate with Google Cloud Platform. Choose one of these methods:

#### Option A: Service Account Key (Recommended for local development)
1. Create a service account in your GCP project
2. Download the JSON key file
3. Set the environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
   ```

#### Option B: Application Default Credentials
If running on GCP (Compute Engine, Cloud Run, etc.), you can use the default service account:
```bash
gcloud auth application-default login
```

### 3. Set Project ID

Set your GCP project ID:
```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

## Usage

### Command Line Tool

Use the provided command-line tool for quick queries:

```bash
# List available datasets
./bin/bigquery_query.py --list-datasets

# List tables in a dataset
./bin/bigquery_query.py --list-tables my_dataset

# Get table schema
./bin/bigquery_query.py --schema my_dataset my_table

# Execute a custom query
./bin/bigquery_query.py --query "SELECT * FROM my_dataset.my_table LIMIT 10"

# Query Sentry events (if you have Sentry data exported to BigQuery)
./bin/bigquery_query.py --events-by-project 123 --start-date 2024-01-01 --end-date 2024-01-07

# Get error frequency analysis
./bin/bigquery_query.py --error-frequency 123 --days 7
```

### Python API

Use the BigQuery client directly in your Python code:

```python
from sentry.utils.bigquery import BigQueryClient, SentryQueries

# Initialize client
bq_client = BigQueryClient()

# List datasets
datasets = bq_client.list_datasets()
print(f"Available datasets: {datasets}")

# Execute a custom query
results = bq_client.query("SELECT COUNT(*) as total FROM my_dataset.events")
print(f"Total events: {results[0]['total']}")

# Use predefined Sentry queries
sql = SentryQueries.events_by_project(
    project_id=123,
    start_date="2024-01-01",
    end_date="2024-01-07"
)
events = bq_client.query(sql)
```

## Common Use Cases

### 1. Analyzing Sentry Events

If you have Sentry data exported to BigQuery, you can analyze:

- Error frequency by project and time period
- User impact analysis
- Performance trends
- Platform and SDK usage

### 2. Cross-Platform Analytics

Combine Sentry data with other data sources:

```sql
SELECT 
    s.project_id,
    s.error_count,
    a.user_count,
    a.session_count
FROM sentry_data.daily_errors s
JOIN analytics_data.daily_usage a
    ON s.project_id = a.project_id 
    AND s.date = a.date
WHERE s.date >= '2024-01-01'
```

### 3. Data Export for BI Tools

Query BigQuery data for use in business intelligence tools:

```python
# Export data for Tableau, Looker, etc.
sql = """
SELECT 
    DATE(timestamp) as date,
    project_id,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users
FROM sentry_data.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY date, project_id
ORDER BY date DESC
"""

results = bq_client.query(sql)
# Convert to pandas DataFrame, CSV, etc.
```

## Configuration Options

### Environment Variables

- `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON key
- `BIGQUERY_LOCATION`: BigQuery processing location (default: "US")

### BigQuery Client Options

```python
# Custom configuration
bq_client = BigQueryClient(
    project_id="my-project",
    credentials_path="/path/to/key.json",
    location="EU"  # For EU data residency
)
```

### Query Job Configuration

```python
from google.cloud import bigquery

# Configure job settings
job_config = bigquery.QueryJobConfig(
    use_query_cache=True,
    use_legacy_sql=False,
    maximum_bytes_billed=1000000,  # Limit costs
    labels={"team": "sentry", "env": "prod"}
)

results = bq_client.query(sql, job_config=job_config)
```

## Best Practices

### 1. Cost Optimization

- Use `LIMIT` clauses to avoid processing unnecessary data
- Use `WHERE` clauses to filter by date/project early
- Consider using `--dry-run` to estimate costs before running expensive queries
- Use clustering and partitioning for large tables

### 2. Performance

- Avoid `SELECT *` on large tables
- Use approximate aggregation functions when possible (`APPROX_COUNT_DISTINCT`)
- Cache results for repeated queries

### 3. Security

- Use service accounts with minimal required permissions
- Don't commit credential files to version control
- Use IAM roles instead of credential files when possible
- Rotate service account keys regularly

## Troubleshooting

### Common Issues

1. **Authentication Error**: Check that `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON key file
2. **Project Not Found**: Verify `GOOGLE_CLOUD_PROJECT` is set correctly
3. **Permission Denied**: Ensure your service account has BigQuery permissions
4. **Query Timeout**: Add appropriate timeouts or break large queries into smaller chunks

### Debugging

Enable debug logging:

```python
import logging
logging.getLogger('google.cloud.bigquery').setLevel(logging.DEBUG)
```

## Integration with Sentry Workflows

### 1. Alert Analysis

Create BigQuery views for common alert patterns:

```sql
CREATE VIEW sentry_analytics.high_error_projects AS
SELECT 
    project_id,
    COUNT(*) as error_count,
    COUNT(DISTINCT issue_id) as unique_issues
FROM sentry_data.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
GROUP BY project_id
HAVING error_count > 100
```

### 2. Performance Monitoring

Track performance metrics over time:

```sql
CREATE VIEW sentry_analytics.performance_trends AS
SELECT 
    DATE(timestamp) as date,
    project_id,
    AVG(CAST(JSON_EXTRACT_SCALAR(measurements, '$.lcp') AS FLOAT64)) as avg_lcp,
    APPROX_QUANTILES(CAST(JSON_EXTRACT_SCALAR(measurements, '$.fcp') AS FLOAT64), 100)[OFFSET(95)] as p95_fcp
FROM sentry_data.transactions
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY date, project_id
```

## Next Steps

1. Set up scheduled BigQuery exports from your Sentry instance
2. Create dashboards using BigQuery data
3. Implement automated alerting based on BigQuery analysis
4. Integrate with your existing data pipeline

For more information, see:
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [BigQuery Python Client](https://googleapis.dev/python/bigquery/latest/)
- [Sentry Data Export Guide](https://docs.sentry.io/product/data-management-settings/export/)