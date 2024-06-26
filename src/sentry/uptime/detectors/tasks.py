import datetime
from datetime import timedelta

from django.utils import timezone

from sentry.locks import locks
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.uptime.detectors.ranking import (
    _get_cluster,
    delete_candidate_urls_for_project,
    delete_project_bucket,
    get_candidate_urls_for_project,
    get_project_bucket,
)
from sentry.uptime.models import ProjectUptimeSubscriptionMode
from sentry.uptime.subscriptions.subscriptions import (
    create_project_uptime_subscription,
    create_uptime_subscription,
    delete_project_uptime_subscription,
    get_auto_monitored_subscriptions_for_project,
    is_url_auto_monitored_for_project,
)
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.locking import UnableToAcquireLock

LAST_PROCESSED_KEY = "uptime_detector_last_processed"
SCHEDULER_LOCK_KEY = "uptime_detector_scheduler_lock"
FAILED_URL_RETRY_FREQ = timedelta(days=7)
URL_MIN_TIMES_SEEN = 5
URL_MIN_PERCENT = 0.05
ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS = int(timedelta(minutes=60).total_seconds())
ONBOARDING_SUBSCRIPTION_TIMEOUT_MS = 1000


@instrumented_task(
    name="sentry.uptime.detectors.tasks.schedule_detections",
    queue="uptime",
    time_limit=60,
    soft_time_limit=55,
)
def schedule_detections():
    """
    Runs regularly and fires off a task for each detection bucket that needs to be run since
    this task last ran.
    """
    lock = locks.get(
        SCHEDULER_LOCK_KEY,
        duration=60,
        name="uptime.detection.schedule_detections",
    )
    try:
        with lock.acquire():
            cluster = _get_cluster()
            last_processed = cluster.get(LAST_PROCESSED_KEY)
            if last_processed is None:
                last_processed = timezone.now().replace(second=0, microsecond=0)
            else:
                last_processed = datetime.datetime.fromtimestamp(
                    int(last_processed), tz=datetime.UTC
                )

            minutes_since_last_processed = int(
                (timezone.now() - last_processed) / timedelta(minutes=1)
            )
            for _ in range(minutes_since_last_processed):
                last_processed = last_processed + timedelta(minutes=1)
                process_detection_bucket.delay(last_processed)

            cluster.set(LAST_PROCESSED_KEY, int(last_processed.timestamp()), timedelta(hours=1))
    except UnableToAcquireLock:
        # If we can't acquire the lock it just means another task is already handling scheduling,
        # so just exit
        metrics.incr("uptime.detectors.scheduler.unable_to_acquire_lock")


@instrumented_task(
    name="sentry.uptime.detectors.tasks.process_detection_bucket",
    queue="uptime",
)
def process_detection_bucket(bucket: datetime.datetime):
    """
    Schedules url detection for all projects in this time bucket that saw promising urls.
    """
    for project_id, count in get_project_bucket(bucket).items():
        process_project_url_ranking.delay(project_id, count)
    delete_project_bucket(bucket)


@instrumented_task(
    name="sentry.uptime.detectors.tasks.process_project_url_ranking",
    queue="uptime",
)
def process_project_url_ranking(project_id: int, project_url_count: int):
    """
    Looks at candidate urls for a project and determines whether we should start monitoring them
    """
    project = Project.objects.get_from_cache(id=project_id)
    if not should_detect_for_project(project):
        return

    for url, url_count in get_candidate_urls_for_project(project)[:5]:
        if process_candidate_url(project, project_url_count, url, url_count):
            # TODO: On success, we want to mark this project as not needing to be checked for a while
            break
    else:
        # TODO: If we don't find any urls to monitor, we want to increment a counter in redis and check the value.
        # After a number of failures, we want to stop checking for this project for a while.
        pass

    delete_candidate_urls_for_project(project)


def process_candidate_url(
    project: Project, project_url_count: int, url: str, url_count: int
) -> bool:
    """
    Takes a candidate url for a project and determines whether we should create an uptime subscription for it.
    Checks that:
     - URL has been seen at least `URL_MIN_TIMES_SEEN` times and is seen in at least `URL_MIN_PERCENT` of events with urls
     - URL hasn't already been checked and failed recently
     - Whether we are already monitoring this url for this project
     - Whether the url's robots.txt will allow us to monitor this url

    If the url passes, and we don't already have a subscription for it, then create a new remote subscription for the
    url and delete any existing automated monitors.
    """
    # The url has to be seen a minimum number of times, and make up at least
    # a certain percentage of all urls seen in this project
    if url_count < URL_MIN_TIMES_SEEN or url_count / project_url_count < URL_MIN_PERCENT:
        return False

    # See if we're already auto monitoring this url on this project
    if is_url_auto_monitored_for_project(project, url):
        # Just mark this successful so `process_project_url_ranking` will choose to not process urls for this project
        # for a week
        return True

    # Check whether we've recently attempted to monitor this url recently and failed.
    if is_failed_url(url):
        return False

    # Check robots.txt to see if it's ok for us to attempt to monitor this url
    if not check_url_robots_txt(url):
        set_failed_url(url)
        return False

    # If we hit this point, then the url looks worth monitoring. Create an uptime subscription in monitor mode.
    # Also check if there's already an existing auto detected monitor for this project. If so, delete it.
    monitor_url_for_project(project, url)
    return True


def monitor_url_for_project(project: Project, url: str):
    """
    Start monitoring a url for a project. Creates a subscription using our onboarding interval and links the project to
    it. Also deletes any other auto detected monitors since this one should replace them.
    """
    for monitored_subscription in get_auto_monitored_subscriptions_for_project(project):
        delete_project_uptime_subscription(project, monitored_subscription.uptime_subscription)
    subscription = create_uptime_subscription(
        url, ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS, ONBOARDING_SUBSCRIPTION_TIMEOUT_MS
    )
    create_project_uptime_subscription(
        project, subscription, ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING
    )


def is_failed_url(url: str) -> bool:
    key = get_failed_url_key(url)
    return _get_cluster().exists(key) == 1


def set_failed_url(url: str) -> None:
    """
    If we failed to monitor a url for some reason, skip processing it for FAILED_URL_RETRY_FREQ
    """
    key = get_failed_url_key(url)
    # TODO: Jitter the expiry here so we don't retry all at the same time.
    _get_cluster().set(key, 1, ex=FAILED_URL_RETRY_FREQ)


def get_failed_url_key(url: str) -> str:
    return f"f:u:{md5_text(url).hexdigest()}"


def check_url_robots_txt(url: str) -> bool:
    # TODO: Implement this check
    return True


def should_detect_for_project(project: Project) -> bool:
    # TODO: Check if project has detection disabled
    # TODO: If we're already running a detected url monitor for this project, we should stop attempting to
    # detect urls for a while
    return True
