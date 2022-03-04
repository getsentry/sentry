from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.clear_expired_raw_events", time_limit=15, soft_time_limit=10)
def clear_expired_raw_events():
    from sentry.models import ProcessingIssue, RawEvent, ReprocessingReport

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
        while True:
            # Django already loads this into memory, might as well do it
            # explicitly. Makes check for result emptiness cheaper.
            result = set(model_cls.objects.filter(**filter)[:200].values_list("pk", flat=True))
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
