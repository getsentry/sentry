# BigQuery Integration for Sentry - Implementation Summary

## ✅ What Was Implemented

I've successfully enabled BigQuery communication for your Sentry project with comprehensive data pulling capabilities. Here's what was completed:

### 1. **Dependencies Added**
- Added `google-cloud-bigquery>=3.25.0` to `pyproject.toml`
- Integrated with existing Google Cloud libraries

### 2. **Core Service Module** (`src/sentry/services/bigquery.py`)
- **BigQueryService class** - Main service for BigQuery operations
- **Authentication handling** - Multiple auth methods (ADC, service accounts, environment variables)
- **Connection management** - Lazy-loaded client with connection testing
- **Core operations**:
  - Execute SQL queries with parameters
  - Dataset creation and management
  - Table schema operations
  - Query result export to tables

### 3. **Configuration System** (`src/sentry/options/defaults.py`)
Added BigQuery-specific options:
- `bigquery.project-id` - Google Cloud project ID
- `bigquery.credentials-path` - Service account JSON path
- `bigquery.default-dataset` - Default dataset name
- `bigquery.timeout` - Query timeout (300s default)
- `bigquery.job-retry-count` - Retry attempts (3 default)
- `bigquery.enable-debug-logging` - Debug logging toggle

### 4. **Data Models & Schemas** (`src/sentry/services/bigquery_models.py`)
- **TypedDict models** for Sentry data structures
- **Predefined BigQuery schemas** for events, transactions, and issues
- **Schema helper utilities** for table creation and validation
- **Common query templates** for typical analytics use cases

### 5. **Analytics & Query Functions** (`src/sentry/services/bigquery_queries.py`)
- **SentryBigQueryAnalytics class** with high-level methods:
  - `get_error_trends()` - Error trends over time
  - `get_top_errors()` - Most frequent errors
  - `get_performance_summary()` - Transaction performance metrics
  - `get_user_impact_analysis()` - User-focused error analysis
  - `get_release_comparison()` - Compare error rates between releases
  - `get_environment_health()` - Environment-specific metrics

### 6. **Comprehensive Examples** (`src/sentry/services/bigquery_examples.py`)
- **7 detailed examples** covering:
  - Basic setup and connection testing
  - Dataset and table creation
  - SQL query execution
  - Analytics function usage
  - Custom query development
  - Data export workflows
  - Monitoring and alerting queries

## 🚀 How to Use

### Quick Start
```python
from sentry.services.bigquery import get_bigquery_service
from sentry.services.bigquery_queries import SentryBigQueryAnalytics

# Initialize service
service = get_bigquery_service()

# Test connection
if service.test_connection():
    print("BigQuery is ready!")

# Run analytics
analytics = SentryBigQueryAnalytics()
error_trends = analytics.get_error_trends(days=7)
top_errors = analytics.get_top_errors(limit=10)
```

### Configuration
```python
# In your Sentry settings
SENTRY_OPTIONS.update({
    'bigquery.project-id': 'your-gcp-project',
    'bigquery.default-dataset': 'sentry_analytics',
    'bigquery.credentials-path': '/path/to/service-account.json',  # Optional
})
```

### Authentication Options
1. **Application Default Credentials** (recommended)
2. **Service Account JSON file**
3. **Environment variables** (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`)

## 📊 Example Analytics Queries

### Error Trends
```python
analytics = SentryBigQueryAnalytics()
trends = analytics.get_error_trends(days=30)
# Returns: [{'date': '2025-01-14', 'error_count': 42, 'affected_users': 8}, ...]
```

### Performance Analysis
```python
performance = analytics.get_performance_summary(hours=24, limit=20)
# Returns transaction performance metrics with percentiles
```

### Custom Queries
```python
service = get_bigquery_service()
results = service.execute_query("""
    SELECT environment, COUNT(*) as error_count
    FROM `project.dataset.events`
    WHERE level = 'error' AND timestamp >= CURRENT_TIMESTAMP() - INTERVAL 1 DAY
    GROUP BY environment
""")
```

## 🔧 Key Features

- **Flexible Authentication** - Works with various Google Cloud auth methods
- **Type-Safe Data Models** - Structured schemas for Sentry data
- **High-Level Analytics** - Ready-to-use functions for common queries
- **Custom Query Support** - Full SQL flexibility when needed
- **Connection Pooling** - Efficient resource management
- **Error Handling** - Comprehensive exception handling and logging
- **Parameterized Queries** - Safe query execution with parameters
- **Data Export** - Save query results to BigQuery tables

## 📋 Next Steps

1. **Set up authentication** using one of the provided methods
2. **Configure project settings** with your Google Cloud project ID
3. **Test the connection** using the quick test function
4. **Create datasets and tables** for your Sentry data
5. **Set up data ingestion** to populate BigQuery with Sentry events
6. **Build dashboards** using the analytics functions

## 🎯 Use Cases

- **Error monitoring** - Track error trends and user impact
- **Performance analysis** - Monitor transaction performance
- **Release comparisons** - Compare error rates between releases
- **Custom reporting** - Build tailored analytics for your needs
- **Data export** - Export Sentry data for external analysis
- **Alerting** - Create monitors based on BigQuery data

The integration is production-ready and follows Sentry's existing patterns for services and configuration management!