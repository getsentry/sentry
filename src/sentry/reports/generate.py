from __future__ import annotations

import csv
import io
import logging
from datetime import date

from django.utils.text import slugify

from sentry.data_export.processors.explore import ExploreProcessor
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.models.organization import Organization
from sentry.reports.models import ScheduledReport

logger = logging.getLogger(__name__)

MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB cap
BATCH_SIZE = 10_000  # Match SNUBA_MAX_RESULTS


def generate_csv_for_explore_query(
    scheduled_report: ScheduledReport, organization: Organization
) -> tuple[str, bytes, bool]:
    """
    Generate a CSV file from the results of an Explore saved query.

    Returns (filename, csv_bytes, empty_result).
    """
    saved_query = ExploreSavedQuery.objects.get(
        id=scheduled_report.source_id,
        organization_id=scheduled_report.organization_id,
    )

    # saved_query.query is a top-level dict; per-query objects are at ["query"]
    query_data = saved_query.query
    query_objects = query_data.get("query", [])

    if len(query_objects) > 1:
        logger.info(
            "scheduled_report.multi_query_truncated",
            extra={"report_id": scheduled_report.id, "query_count": len(query_objects)},
        )
    query_params = query_objects[0] if query_objects else {}

    query_dict: dict = {
        "field": query_params.get("fields", []),
        "query": query_params.get("query", ""),
        "dataset": ExploreSavedQueryDataset.get_type_name(saved_query.dataset),
        "project": list(saved_query.projects.values_list("id", flat=True)),
        "environment": query_data.get("environment", []),
        "sort": query_params.get("orderby"),
        "equations": query_params.get("equations", []),
    }

    # Date range: override with scheduled_report.time_range or fall back to saved query range.
    # get_date_range_from_params() looks for "statsPeriod", not "range".
    if scheduled_report.time_range:
        query_dict["statsPeriod"] = scheduled_report.time_range
    else:
        raw_range = query_data.get("range") or query_data.get("statsPeriod") or "24h"
        query_dict["statsPeriod"] = raw_range

    processor = ExploreProcessor(organization, query_dict)

    byte_buffer = io.BytesIO()
    text_wrapper = io.TextIOWrapper(byte_buffer, encoding="utf-8", newline="")
    writer = csv.DictWriter(
        text_wrapper, processor.header_fields, extrasaction="ignore", escapechar="\\"
    )
    writer.writeheader()
    text_wrapper.flush()

    offset = 0
    while True:
        rows = processor.run_query(offset, BATCH_SIZE)
        if not rows:
            break
        writer.writerows(rows)
        text_wrapper.flush()
        offset += len(rows)
        if byte_buffer.tell() > MAX_CSV_BYTES:
            logger.warning(
                "scheduled_report.csv_size_exceeded",
                extra={"report_id": scheduled_report.id, "rows": offset},
            )
            break
        if len(rows) < BATCH_SIZE:
            break

    text_wrapper.flush()
    csv_bytes = byte_buffer.getvalue()
    text_wrapper.detach()
    filename = f"{slugify(saved_query.name)}_{date.today().isoformat()}.csv"
    return filename, csv_bytes, offset == 0
