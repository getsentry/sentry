#!/usr/bin/env python3
"""
Extract LLM Issue Evidence Data from Sentry Issues

Usage:
    export SENTRY_AUTH_TOKEN="your_token_here"
    python scripts/extract_llm_issue_evidence.py input.csv output.csv
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from typing import Any

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class SentryAPIClient:
    def __init__(self, auth_token: str, org_slug: str = "sentry"):
        self.base_url = "https://sentry.sentry.io"
        self.org_slug = org_slug
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {auth_token}"})

    def get_all_events(self, issue_id: str) -> list[dict[str, Any]]:
        """Fetch all event summaries for an issue."""
        url = f"{self.base_url}/api/0/organizations/{self.org_slug}/issues/{issue_id}/events/"
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException:
            logger.exception("Failed to fetch events", extra={"issue_id": issue_id})
            return []

    def get_event_details(self, issue_id: str, event_id: str) -> dict[str, Any] | None:
        """Fetch full event details including occurrence data."""
        url = f"{self.base_url}/api/0/organizations/{self.org_slug}/issues/{issue_id}/events/{event_id}/"
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException:
            logger.exception("Failed to fetch event", extra={"event_id": event_id})
            return None


def extract_evidence_data(event: dict[str, Any]) -> dict[str, Any] | None:
    """Extract DetectedIssue fields from event occurrence evidence_data."""
    occurrence = event.get("occurrence")
    if not occurrence:
        return None

    evidence_data = occurrence.get("evidenceData", {})
    if not evidence_data:
        return None

    return {
        "title": occurrence.get("issueTitle") or "",
        "explanation": evidence_data.get("explanation") or "",
        "impact": evidence_data.get("impact") or "",
        "evidence": evidence_data.get("evidence") or "",
        "missing_telemetry": evidence_data.get("missingTelemetry")
        or evidence_data.get("missing_telemetry")
        or "",
    }


def process_csv(input_file: str, output_file: str, api_client: SentryAPIClient):
    """Process input CSV and extract evidence data for all events."""
    with open(input_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        input_rows = list(reader)

    logger.info(
        "Processing issues from file",
        extra={"issue_count": len(input_rows), "input_file": input_file},
    )
    output_rows = []

    for idx, row in enumerate(input_rows, 1):
        issue_id = row.get("issue_id")
        if not issue_id:
            logger.warning("Row missing issue_id, skipping", extra={"row_number": idx})
            continue

        logger.info(
            "Processing issue",
            extra={"issue_id": issue_id, "progress": f"{idx}/{len(input_rows)}"},
        )

        event_summaries = api_client.get_all_events(issue_id)
        if not event_summaries:
            logger.warning("No events found for issue", extra={"issue_id": issue_id})
            continue

        logger.info("Found events", extra={"event_count": len(event_summaries)})

        for event_summary in event_summaries:
            event_id = event_summary.get("eventID") or event_summary.get("id")
            if not event_id:
                continue

            full_event = api_client.get_event_details(issue_id, event_id)
            if not full_event:
                continue

            evidence = extract_evidence_data(full_event)
            if not evidence:
                continue

            output_rows.append({"issue_id": issue_id, **evidence})

    if output_rows:
        with open(output_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(output_rows[0].keys()))
            writer.writeheader()
            writer.writerows(output_rows)
        logger.info("Wrote events to file", extra={"event_count": len(output_rows)})
    else:
        logger.warning("No events with evidence data found")


def main():
    parser = argparse.ArgumentParser(description="Extract LLM issue evidence from Sentry issues")
    parser.add_argument("input_csv", help="Input CSV with issue_id column")
    parser.add_argument("output_csv", help="Output CSV file")
    args = parser.parse_args()

    token = os.environ.get("SENTRY_AUTH_TOKEN")
    if not token:
        logger.error("Set SENTRY_AUTH_TOKEN environment variable")
        sys.exit(1)

    if not os.path.exists(args.input_csv):
        logger.error("Input file not found", extra={"input_csv": args.input_csv})
        sys.exit(1)

    process_csv(args.input_csv, args.output_csv, SentryAPIClient(token))
    logger.info("Done! Output saved", extra={"output_csv": args.output_csv})


if __name__ == "__main__":
    main()
