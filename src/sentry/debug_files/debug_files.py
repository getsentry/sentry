from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

from django.db import router
from django.utils import timezone

from sentry import options
from sentry.models.debugfile import ProjectDebugFile
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


def maybe_renew_debug_files(debug_files: Sequence[ProjectDebugFile]) -> None:
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(
        days=options.get("system.debug-files-renewal-age-threshold-days")
    )

    ids_to_renew = []
    for dif in debug_files:
        if dif.date_accessed > threshold_date:
            continue

        # For Objectstore-backed files, issue a HEAD request to bump the TTI.
        if dif.storage_path is not None:
            try:
                dif._get_objectstore_session().head(dif.storage_path)
            except Exception:
                logger.exception(
                    "debugfile.objectstore_tti_renewal_failed",
                    extra={
                        "project_debug_file_id": dif.id,
                        "project_id": dif.project_id,
                        "storage_path": dif.storage_path,
                    },
                )
                continue

        ids_to_renew.append(dif.id)

    if not ids_to_renew:
        return

    # Update `date_accessed` in the db.
    with metrics.timer("debug_files_renewal"):
        with atomic_transaction(using=(router.db_for_write(ProjectDebugFile),)):
            updated_rows_count = ProjectDebugFile.objects.filter(
                id__in=ids_to_renew, date_accessed__lte=threshold_date
            ).update(date_accessed=now)
            if updated_rows_count > 0:
                metrics.incr("debug_files_renewal.were_renewed", updated_rows_count)
