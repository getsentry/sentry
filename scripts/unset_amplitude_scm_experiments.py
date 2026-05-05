#!/usr/bin/env python3
"""
One-shot script to unset stale Amplitude experiment group properties
for the SCM onboarding experiments.

Mirrors the logic from getsentry/etl#2521 but runs locally instead of
as an Airflow DAG.

Usage:
    AMPLITUDE_API_KEY=<key> python scripts/unset_amplitude_scm_experiments.py [--dry-run]

Requires: google-cloud-bigquery, requests
    pip install google-cloud-bigquery requests pandas db-dtypes
"""

import argparse
import logging
import os
import sys

from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
logging.getLogger("amplitude").setLevel(logging.WARNING)

BIGQUERY_PROJECT = "super-big-data"

CLEANUP_SQL = """
WITH bad_exposures AS (
  SELECT DISTINCT
    SAFE_CAST(organization_id AS INT64) AS organization_id,
    JSON_EXTRACT_SCALAR(data, '$.experiment_name') AS experiment_name
  FROM analytics.events_denormalized
  WHERE type = 'experiment.exposure'
    AND timestamp < TIMESTAMP('2026-04-29 04:00:00 UTC')
    AND dt >= DATE('2026-04-02')
    AND JSON_EXTRACT_SCALAR(data, '$.experiment_name') IN (
      'onboarding-scm-experiment',
      'onboarding-scm-project-details-experiment'
    )
),
good_exposures AS (
  SELECT DISTINCT
    SAFE_CAST(organization_id AS INT64) AS organization_id,
    JSON_EXTRACT_SCALAR(data, '$.experiment_name') AS experiment_name
  FROM analytics.events_denormalized
  WHERE type = 'experiment.exposure'
    AND timestamp >= TIMESTAMP('2026-04-29 04:00:00 UTC')
    AND dt >= DATE('2026-04-29')
    AND JSON_EXTRACT_SCALAR(data, '$.experiment_name') IN (
      'onboarding-scm-experiment',
      'onboarding-scm-project-details-experiment'
    )
)
SELECT
  b.organization_id,
  ARRAY_AGG(b.experiment_name) AS experiments_to_unset
FROM bad_exposures b
LEFT JOIN good_exposures g
  ON b.organization_id = g.organization_id
  AND b.experiment_name = g.experiment_name
WHERE g.organization_id IS NULL
GROUP BY b.organization_id
"""


def _property_key(experiment_name: str) -> str:
    return "experiment_" + experiment_name.replace("-", "_")


def main():
    parser = argparse.ArgumentParser(
        description="Unset stale Amplitude SCM experiment group properties"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Query BigQuery and show what would be sent, but don't call Amplitude",
    )
    parser.add_argument(
        "--amplitude-api-key",
        default=None,
        help="Amplitude API key (or set AMPLITUDE_API_KEY env var)",
    )
    parser.add_argument(
        "--org-id",
        default=None,
        help="Only process this specific organization ID (for testing)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N organizations",
    )
    args = parser.parse_args()

    api_key = args.amplitude_api_key or os.environ.get("AMPLITUDE_API_KEY")
    if not api_key and not args.dry_run:
        logger.error("AMPLITUDE_API_KEY env var or --amplitude-api-key is required")
        sys.exit(1)

    bq_client = bigquery.Client(project=BIGQUERY_PROJECT)
    logger.info("Running cleanup query against BigQuery...")
    df = bq_client.query(CLEANUP_SQL).to_dataframe()
    logger.info("Found %d orgs to unset", len(df))

    if args.org_id:
        df = df[df["organization_id"] == int(args.org_id)]
        logger.info("Filtered to org %s: %d rows", args.org_id, len(df))

    if args.limit:
        df = df.head(args.limit)
        logger.info("Limited to first %d orgs", args.limit)

    if df.empty:
        logger.info("Nothing to do")
        return

    groups = []
    for _, row in df.iterrows():
        experiment_names = list(row["experiments_to_unset"])
        keys = [_property_key(name) for name in experiment_names]
        groups.append(
            {
                "group_type": "organization_id",
                "group_value": str(row["organization_id"]),
                "group_properties": {"$unset": {key: "-" for key in keys}},
            }
        )

    if args.dry_run:
        logger.info("DRY RUN — would send %d group identify events:", len(groups))
        for g in groups:
            logger.info(
                "  org=%s  unset=%s",
                g["group_value"],
                list(g["group_properties"]["$unset"].keys()),
            )
        return

    from amplitude import Amplitude, GroupIdentifyEvent

    success_count = 0
    error_count = 0

    def _on_event(event, code, message):
        nonlocal success_count, error_count
        if code == 200:
            success_count += 1
        else:
            error_count += 1
            logger.warning(
                "Amplitude error code=%s message=%s event=%s",
                code,
                message,
                event.group_properties if hasattr(event, "group_properties") else "",
            )

    amplitude_client = Amplitude(api_key)
    amplitude_client.configuration.use_batch = True
    amplitude_client.configuration.callback = _on_event

    batch_size = 1000
    for i, g in enumerate(groups):
        event = GroupIdentifyEvent(
            user_id="$group_identify",
            groups={g["group_type"]: g["group_value"]},
            group_properties=g["group_properties"],
        )
        amplitude_client.track(event)

        if (i + 1) % batch_size == 0:
            for future in amplitude_client.flush() or []:
                if future is not None:
                    future.result()
            logger.info("Flushed batch %d/%d", i + 1, len(groups))

    for future in amplitude_client.flush() or []:
        if future is not None:
            future.result()
    logger.info(
        "Done — processed %d organizations (success=%d, errors=%d)",
        len(groups),
        success_count,
        error_count,
    )


if __name__ == "__main__":
    main()
