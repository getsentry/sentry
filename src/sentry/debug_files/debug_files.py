from __future__ import annotations

from datetime import timedelta
from typing import Sequence

from django.db import router
from django.db.models import Q
from django.utils import timezone

from sentry.models.debugfile import ProjectDebugFile
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

# TODO: merge this with artifact bundles
# Number of days that determine whether a debug file is ready for being renewed.
AVAILABLE_FOR_RENEWAL_DAYS = 30


def maybe_renew_debug_files(query: Q, debug_files: Sequence[ProjectDebugFile]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    # We first check if any file needs renewal, before going to the database.
    needs_bump = any(dif.date_accessed <= threshold_date for dif in debug_files)
    if not needs_bump:
        return

    with metrics.timer("debug_files_renewal"):
        with atomic_transaction(using=(router.db_for_write(ProjectDebugFile),)):
            updated_rows_count = ProjectDebugFile.objects.filter(
                query, date_accessed__lte=threshold_date
            ).update(date_accessed=now)
            if updated_rows_count > 0:
                metrics.incr("debug_files_renewal.were_renewed", updated_rows_count)
