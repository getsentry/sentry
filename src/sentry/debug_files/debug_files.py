from __future__ import annotations
from typing import int

from collections.abc import Sequence
from datetime import timedelta

from django.db import router
from django.utils import timezone

from sentry import options
from sentry.models.debugfile import ProjectDebugFile
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction


def maybe_renew_debug_files(debug_files: Sequence[ProjectDebugFile]) -> None:
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(
        days=options.get("system.debug-files-renewal-age-threshold-days")
    )

    # We first check if any file needs renewal, before going to the database.
    needs_bump = any(dif.date_accessed <= threshold_date for dif in debug_files)
    if not needs_bump:
        return

    ids = [dif.id for dif in debug_files]
    with metrics.timer("debug_files_renewal"):
        with atomic_transaction(using=(router.db_for_write(ProjectDebugFile),)):
            updated_rows_count = ProjectDebugFile.objects.filter(
                id__in=ids, date_accessed__lte=threshold_date
            ).update(date_accessed=now)
            if updated_rows_count > 0:
                metrics.incr("debug_files_renewal.were_renewed", updated_rows_count)
