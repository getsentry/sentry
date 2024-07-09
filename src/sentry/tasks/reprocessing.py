import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.reprocess_events",
    queue="events.reprocess_events",
    silo_mode=SiloMode.REGION,
)
def reprocess_events(project_id, **kwargs):
    pass


@instrumented_task(
    name="sentry.tasks.clear_expired_raw_events",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def clear_expired_raw_events():
    from sentry.models.processingissue import ProcessingIssue
    from sentry.models.rawevent import RawEvent
    from sentry.models.reprocessingreport import ReprocessingReport

    # Max number of times to attempt to query each model
    MAX_BATCHES_PER_MODEL = 10000
    # Number of rows to fetch/delete for each query
    LIMIT_PER_QUERY = 100

    def batched_delete(model_cls, **filter):
        # Django 1.6's `Queryset.delete` runs in this order:
        #
        # 1. Fetch all models
        # 2. Call all `on_delete`s
        # 3. Delete from DB (batched `DELETE WHERE id in (...)`)
        #
        # Since we attempt to unpickle `NodeField`s in Step 2, we might time
        # out at that point and never do the delete.
        #
        # Better to delete a few rows than none.
        for _ in range(MAX_BATCHES_PER_MODEL):
            # Django already loads this into memory, might as well do it
            # explicitly. Makes check for result emptiness cheaper.
            result = set(
                model_cls.objects.filter(**filter)[:LIMIT_PER_QUERY].values_list("pk", flat=True)
            )
            if not result:
                break

            # Django ORM can't do delete with limit
            model_cls.objects.filter(pk__in=result).delete()

    cutoff = timezone.now() - timedelta(days=settings.SENTRY_RAW_EVENT_MAX_AGE_DAYS)

    # Clear old raw events and reprocessing reports
    batched_delete(RawEvent, datetime__lt=cutoff)
    batched_delete(ReprocessingReport, datetime__lt=cutoff)

    # Processing issues get a bit of extra time before we delete them
    cutoff = timezone.now() - timedelta(days=int(settings.SENTRY_RAW_EVENT_MAX_AGE_DAYS * 1.3))
    batched_delete(ProcessingIssue, datetime__lt=cutoff)
