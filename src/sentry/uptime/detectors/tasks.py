import datetime
import logging
from datetime import timedelta
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

from django.utils import timezone

from sentry import audit_log, features
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.uptime.detectors.ranking import (
    _get_cluster,
    delete_candidate_projects_for_org,
    delete_candidate_urls_for_project,
    delete_organization_bucket,
    get_candidate_projects_for_org,
    get_candidate_urls_for_project,
    get_organization_bucket,
    should_detect_for_organization,
    should_detect_for_project,
)
from sentry.uptime.models import ProjectUptimeSubscription, ProjectUptimeSubscriptionMode
from sentry.uptime.subscriptions.subscriptions import (
    delete_uptime_subscriptions_for_project,
    get_auto_monitored_subscriptions_for_project,
    get_or_create_project_uptime_subscription,
    is_url_auto_monitored_for_project,
)
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.hashlib import md5_text
from sentry.utils.locking import UnableToAcquireLock

UPTIME_USER_AGENT = "SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)"
LAST_PROCESSED_KEY = "uptime_detector_last_processed"
SCHEDULER_LOCK_KEY = "uptime_detector_scheduler_lock"
FAILED_URL_RETRY_FREQ = timedelta(days=7)
URL_MIN_TIMES_SEEN = 5
URL_MIN_PERCENT = 0.05
# Default value for how often we should run these subscriptions when onboarding them
ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS = int(timedelta(minutes=60).total_seconds())
# Default timeout for auto-detected uptime monitors
ONBOARDING_SUBSCRIPTION_TIMEOUT_MS = 10_000

logger = logging.getLogger("sentry.uptime-url-autodetection")


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
                metrics.incr("uptime.detectors.scheduler.scheduled_bucket")
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
    for organization_id in get_organization_bucket(bucket):
        metrics.incr("uptime.detectors.scheduler.scheduled_organization")
        process_organization_url_ranking.delay(organization_id)
    delete_organization_bucket(bucket)


@instrumented_task(
    name="sentry.uptime.detectors.tasks.process_organization_url_ranking",
    queue="uptime",
)
def process_organization_url_ranking(organization_id: int):
    org = Organization.objects.get_from_cache(id=organization_id)
    logger.info(
        "uptime.process_organization",
        extra={"organization_id": org.id},
    )
    should_detect = should_detect_for_organization(org)

    for project_id, project_count in get_candidate_projects_for_org(org):
        project = Project.objects.get_from_cache(id=project_id)
        if not should_detect:
            # We still want to clear up these urls even if we're no longer detecting
            delete_candidate_urls_for_project(project)
        else:
            if process_project_url_ranking(project, project_count):
                metrics.incr("uptime.detectors.scheduler.detected_url_for_organization")
                should_detect = False

    delete_candidate_projects_for_org(org)


def process_project_url_ranking(project: Project, project_url_count: int) -> bool:
    """
    Looks at candidate urls for a project and determines whether we should start monitoring them
    """
    logger.info(
        "uptime.process_project",
        extra={
            "project_id": project.id,
            "project_url_count": project_url_count,
        },
    )
    if not should_detect_for_project(project):
        metrics.incr("uptime.detectors.project_detection_skipped")
        return False

    found_url = False

    for url, url_count in get_candidate_urls_for_project(project)[:5]:
        if process_candidate_url(project, project_url_count, url, url_count):
            found_url = True
            break
    else:
        # TODO: If we don't find any urls to monitor, we want to increment a counter in redis and check the value.
        # After a number of failures, we want to stop checking for this project for a while.
        pass

    delete_candidate_urls_for_project(project)
    return found_url


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
    logger.info(
        "uptime.process_project_url",
        extra={
            "project_id": project.id,
            "project_url_count": project_url_count,
            "url": url,
            "url_count": url_count,
        },
    )
    # The url has to be seen a minimum number of times, and make up at least
    # a certain percentage of all urls seen in this project
    if url_count < URL_MIN_TIMES_SEEN or url_count / project_url_count < URL_MIN_PERCENT:
        metrics.incr("uptime.detectors.candidate_url.failed", tags={"reason": "below_thresholds"})
        return False

    # See if we're already auto monitoring this url on this project
    if is_url_auto_monitored_for_project(project, url):
        # Just mark this successful so `process_project_url_ranking` will choose to not process urls for this project
        # for a week
        metrics.incr("uptime.detectors.candidate_url.failed", tags={"reason": "already_monitored"})
        return True

    # Check whether we've recently attempted to monitor this url recently and failed.
    if is_failed_url(url):
        metrics.incr("uptime.detectors.candidate_url.failed", tags={"reason": "previously_failed"})
        return False

    # Check robots.txt to see if it's ok for us to attempt to monitor this url
    if not check_url_robots_txt(url):
        metrics.incr("uptime.detectors.candidate_url.failed", tags={"reason": "robots_txt"})
        logger.info(
            "uptime.url_failed_robots_txt_check",
            extra={
                "url": url,
                "project": project.id,
            },
        )
        set_failed_url(url)
        return False

    logger.info(
        "uptime.url_autodetected",
        extra={
            "url": url,
            "project": project.id,
        },
    )
    if features.has("organizations:uptime-automatic-subscription-creation", project.organization):
        # If we hit this point, then the url looks worth monitoring. Create an uptime subscription in monitor mode.
        uptime_monitor = monitor_url_for_project(project, url)
        # Disable auto-detection on this project and organization now that we've successfully found a hostname
        project.update_option("sentry:uptime_autodetection", False)
        project.organization.update_option("sentry:uptime_autodetection", False)
        create_audit_entry_from_user(
            user=None,
            organization=project.organization,
            target_object=uptime_monitor.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
            data=uptime_monitor.get_audit_log_data(),
        )

    metrics.incr("uptime.detectors.candidate_url.succeeded", sample_rate=1.0)
    return True


def monitor_url_for_project(project: Project, url: str) -> ProjectUptimeSubscription:
    """
    Start monitoring a url for a project. Creates a subscription using our onboarding interval and links the project to
    it. Also deletes any other auto-detected monitors since this one should replace them.
    """
    for monitored_subscription in get_auto_monitored_subscriptions_for_project(project):
        delete_uptime_subscriptions_for_project(
            project,
            monitored_subscription.uptime_subscription,
            modes=[
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            ],
        )
    metrics.incr("uptime.detectors.candidate_url.monitor_created", sample_rate=1.0)
    return get_or_create_project_uptime_subscription(
        project,
        # TODO(epurkhiser): This is where we would put the environment object
        # from autodetection if we decide to do that.
        environment=None,
        url=url,
        interval_seconds=ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS,
        timeout_ms=ONBOARDING_SUBSCRIPTION_TIMEOUT_MS,
        mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
    )[0]


def is_failed_url(url: str) -> bool:
    key = get_failed_url_key(url)
    return _get_cluster().exists(key) == 1


def set_failed_url(url: str) -> None:
    """
    If we failed to monitor a url for some reason, skip processing it for FAILED_URL_RETRY_FREQ
    """
    key = get_failed_url_key(url)
    # TODO: Jitter the expiry here, so we don't retry all at the same time.
    _get_cluster().set(key, 1, ex=FAILED_URL_RETRY_FREQ)


def get_failed_url_key(url: str) -> str:
    return f"f:u:{md5_text(url).hexdigest()}"


def check_url_robots_txt(url: str) -> bool:
    try:
        return get_robots_txt_parser(url).can_fetch(UPTIME_USER_AGENT, url)
    except Exception:
        logger.warning("Failed to check robots.txt", exc_info=True)
        return True


def get_robots_txt_parser(url: str) -> RobotFileParser:
    robot_parser = RobotFileParser(url=urljoin(url, "robots.txt"))
    robot_parser.read()
    return robot_parser
