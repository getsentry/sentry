#!/usr/bin/env python3
"""
BigQuery Query Tool for Sentry

A command-line tool to query BigQuery tables with common Sentry analytics patterns.

Usage:
    python bin/bigquery_query.py --help
    python bin/bigquery_query.py --list-datasets
    python bin/bigquery_query.py --list-tables dataset_name
    python bin/bigquery_query.py --query "SELECT * FROM dataset.table LIMIT 10"
    python bin/bigquery_query.py --schema dataset_name table_name
    python bin/bigquery_query.py --events-by-project 123 --start-date 2024-01-01 --end-date 2024-01-07
"""

import argparse
import json
import sys
from typing import Any, Dict, List

# Add the src directory to the path so we can import from sentry
sys.path.insert(0, 'src')

from sentry.utils.bigquery import BigQueryClient, SentryQueries


def format_output(data: List[Dict[str, Any]], format_type: str = "table") -> str:
    """Format query results for display."""
    if not data:
        return "No results found."
    
    if format_type == "json":
        return json.dumps(data, indent=2, default=str)
    
    # Simple table format
    if not data:
        return "No data to display."
    
    # Get column headers
    headers = list(data[0].keys())
    
    # Calculate column widths
    col_widths = {}
    for header in headers:
        col_widths[header] = max(
            len(str(header)),
            max(len(str(row.get(header, ""))) for row in data)
        )
    
    # Build table
    lines = []
    
    # Header row
    header_row = " | ".join(str(header).ljust(col_widths[header]) for header in headers)
    lines.append(header_row)
    lines.append("-" * len(header_row))
    
    # Data rows
    for row in data:
        data_row = " | ".join(str(row.get(header, "")).ljust(col_widths[header]) for header in headers)
        lines.append(data_row)
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="BigQuery Query Tool for Sentry",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --list-datasets
  %(prog)s --list-tables my_dataset
  %(prog)s --query "SELECT * FROM my_dataset.my_table LIMIT 10"
  %(prog)s --schema my_dataset my_table
  %(prog)s --events-by-project 123 --start-date 2024-01-01 --end-date 2024-01-07
        """
    )
    
    # BigQuery connection options
    parser.add_argument("--project", help="GCP project ID (or set GOOGLE_CLOUD_PROJECT env var)")
    parser.add_argument("--credentials", help="Path to service account JSON (or set GOOGLE_APPLICATION_CREDENTIALS env var)")
    parser.add_argument("--location", default="US", help="BigQuery location (default: US)")
    
    # Query operations
    parser.add_argument("--list-datasets", action="store_true", help="List all datasets")
    parser.add_argument("--list-tables", metavar="DATASET", help="List tables in a dataset")
    parser.add_argument("--schema", nargs=2, metavar=("DATASET", "TABLE"), help="Get table schema")
    parser.add_argument("--query", help="Execute a custom SQL query")
    
    # Sentry-specific queries
    parser.add_argument("--events-by-project", type=int, metavar="PROJECT_ID", help="Query events for a specific Sentry project")
    parser.add_argument("--error-frequency", type=int, metavar="PROJECT_ID", help="Query error frequency by issue for a project")
    parser.add_argument("--start-date", help="Start date for queries (YYYY-MM-DD)")
    parser.add_argument("--end-date", help="End date for queries (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=7, help="Number of days to look back (default: 7)")
    parser.add_argument("--dataset", default="sentry_data", help="BigQuery dataset name (default: sentry_data)")
    
    # Output options
    parser.add_argument("--format", choices=["table", "json"], default="table", help="Output format")
    parser.add_argument("--dry-run", action="store_true", help="Validate query without executing")
    parser.add_argument("--limit", type=int, help="Limit number of results")
    
    args = parser.parse_args()
    
    try:
        # Initialize BigQuery client
        bq_client = BigQueryClient(
            project_id=args.project,
            credentials_path=args.credentials,
            location=args.location
        )
        
        # Execute requested operation
        if args.list_datasets:
            datasets = bq_client.list_datasets()
            print("Available datasets:")
            for dataset in datasets:
                print(f"  - {dataset}")
        
        elif args.list_tables:
            tables = bq_client.list_tables(args.list_tables)
            print(f"Tables in dataset '{args.list_tables}':")
            for table in tables:
                print(f"  - {table}")
        
        elif args.schema:
            dataset_id, table_id = args.schema
            schema = bq_client.get_table_schema(dataset_id, table_id)
            print(f"Schema for {dataset_id}.{table_id}:")
            print(format_output(schema, args.format))
        
        elif args.query:
            sql = args.query
            if args.limit and "LIMIT" not in sql.upper():
                sql += f" LIMIT {args.limit}"
            
            results = bq_client.query(sql, dry_run=args.dry_run)
            if not args.dry_run:
                print(format_output(results, args.format))
        
        elif args.events_by_project:
            if not args.start_date or not args.end_date:
                print("Error: --start-date and --end-date are required for events query")
                sys.exit(1)
            
            sql = SentryQueries.events_by_project(
                args.events_by_project,
                args.start_date,
                args.end_date,
                args.dataset
            )
            
            if args.limit:
                sql = sql.replace("LIMIT 1000", f"LIMIT {args.limit}")
            
            print(f"Querying events for project {args.events_by_project} from {args.start_date} to {args.end_date}")
            results = bq_client.query(sql, dry_run=args.dry_run)
            if not args.dry_run:
                print(format_output(results, args.format))
        
        elif args.error_frequency:
            sql = SentryQueries.error_frequency_by_issue(
                args.error_frequency,
                args.days,
                args.dataset
            )
            
            if args.limit:
                sql = sql.replace("LIMIT 100", f"LIMIT {args.limit}")
            
            print(f"Querying error frequency for project {args.error_frequency} (last {args.days} days)")
            results = bq_client.query(sql, dry_run=args.dry_run)
            if not args.dry_run:
                print(format_output(results, args.format))
        
        else:
            print("Error: Please specify an operation. Use --help for usage information.")
            sys.exit(1)
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()