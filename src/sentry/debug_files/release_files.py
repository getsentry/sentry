from __future__ import annotations

from datetime import timedelta

from django.db import router
from django.utils import timezone

from sentry.models.releasefile import ReleaseFile
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

# Number of days that determine whether a release file is ready for being renewed.
AVAILABLE_FOR_RENEWAL_DAYS = 30


def maybe_renew_releasefiles(releasefiles: list[ReleaseFile]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    # We first check if any file needs renewal, before going to the database.
    needs_bump = [rf.id for rf in releasefiles if rf.date_accessed <= threshold_date]
    if not needs_bump:
        return

    renew_releasefiles_by_id(needs_bump)


def renew_releasefiles_by_id(releasefile_ids: list[int]):
    now = timezone.now()
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    with metrics.timer("release_files_renewal"):
        with atomic_transaction(using=(router.db_for_write(ReleaseFile),)):
            updated_rows_count = ReleaseFile.objects.filter(
                id__in=releasefile_ids, date_accessed__lte=threshold_date
            ).update(date_accessed=now)
            if updated_rows_count > 0:
                metrics.incr("release_files_renewal.were_renewed", updated_rows_count)
