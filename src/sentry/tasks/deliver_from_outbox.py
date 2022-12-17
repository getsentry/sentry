import logging

from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.scheduler")


@instrumented_task(name="sentry.tasks.enqueue_outbox_jobs")
def enqueue_outbox_jobs(**kwargs):
    pass


def enqueue_region_jobs():
    pass
    # RegionOutbox.objects.all().distinct("")
    #
    # with locks.get("scheduler.process", duration=60, name="scheduler_process").acquire():
    #     job_list = list(ScheduledJob.objects.filter(date_scheduled__lte=timezone.now())[:101])
    #
    #     if len(job_list) > 100:
    #         logger.debug("More than 100 ScheduledJobs found.")
    #
    #     for job in job_list:
    #         logger.debug("Sending scheduled job %s with payload %r", job.name, job.payload)
    #         app.send_task(job.name, kwargs=job.payload)
    #         job.delete()
