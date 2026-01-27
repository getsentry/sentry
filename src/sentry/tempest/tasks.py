import logging
import time

import requests
import sentry_sdk
from django.conf import settings
from requests import Response
from requests.exceptions import ConnectionError, ReadTimeout, Timeout

from sentry import options
from sentry.locks import locks
from sentry.models.projectkey import ProjectKey, UseCase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.taskworker.namespaces import tempest_tasks
from sentry.tempest.models import MessageType, TempestCredentials
from sentry.tempest.utils import has_tempest_access
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest",
    namespace=tempest_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def poll_tempest(**kwargs):
    for credentials in TempestCredentials.objects.select_related("project__organization").all():
        # Note: We are caching credentials in the database even if users don't have access to them.
        # However the latest_fetched_item_id is unique per credentials, and we do not allow PUT/PATCH
        # calls on credentials resources, so if users want to switch to a different credentials pair
        # they need to delete the existing credentials and create a new one.
        if not has_tempest_access(credentials.project.organization):
            # If users don't have access to Tempest we reset the latest_fetched_item_id to None
            # so that in the next iteration of the job we first fetch the latest ID again.
            credentials.latest_fetched_item_id = None
            continue

        if credentials.latest_fetched_item_id is None:
            fetch_latest_item_id.apply_async(
                kwargs={"credentials_id": credentials.id},
                headers={"sentry-propagate-traces": False},
            )
        else:
            poll_tempest_crashes.apply_async(
                kwargs={"credentials_id": credentials.id},
                headers={"sentry-propagate-traces": False},
            )


@instrumented_task(
    name="sentry.tempest.tasks.fetch_latest_item_id",
    namespace=tempest_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def fetch_latest_item_id(credentials_id: int, **kwargs) -> None:
    # Lock duration should be slightly longer than the task deadline to prevent
    # overlapping tasks for the same credential. If a task is still running when
    # the next poll_tempest fires, the new task will skip this credential.
    lock_duration = options.get("tempest.task-deadline-seconds") + options.get(
        "tempest.lock-buffer-seconds"
    )
    lock = locks.get(
        f"tempest:fetch_latest_id:{credentials_id}",
        duration=lock_duration,
        name="tempest_fetch_latest_id",
    )
    try:
        with lock.acquire():
            _fetch_latest_item_id_impl(credentials_id)
    except UnableToAcquireLock:
        # Another task is already processing this credential, skip silently.
        # This is expected when tasks take longer than the polling interval.
        metrics.incr("tempest.latest_id.skipped", tags={"reason": "lock_held"})


def _fetch_latest_item_id_impl(credentials_id: int) -> None:
    """Implementation of fetch_latest_item_id, separated for locking."""
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id
    client_id = credentials.client_id

    sentry_sdk.set_user({"id": f"{org_id}-{project_id}"})
    tags = {"org_id": str(org_id), "project_id": str(project_id)}

    start_time = time.time()
    error_type = None

    try:
        response = fetch_latest_id_from_tempest(
            org_id=org_id,
            project_id=project_id,
            client_id=client_id,
            client_secret=credentials.client_secret,
        )

        # Record timing and response metrics
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.latest_id.duration", duration_ms, tags=tags)
        metrics.distribution(
            "tempest.latest_id.response_size_bytes",
            len(response.content),
            tags=tags,
        )

        result = response.json()

        if "latest_id" in result:
            if result["latest_id"] is None:
                # If there are no crashes in the CRS we want to communicate that back to the
                # customer so that they are not surprised about no crashes arriving.
                credentials.message = "Connection successful. No crashes found in the crash report system yet. New crashes will appear here automatically when they occur."
                credentials.message_type = MessageType.WARNING
                credentials.save(update_fields=["message", "message_type"])
                metrics.incr("tempest.latest_id.success", tags={**tags, "result": "no_crashes"})
                return
            else:
                credentials.latest_fetched_item_id = result["latest_id"]
                credentials.message = ""
                credentials.message_type = MessageType.SUCCESS
                credentials.save(
                    update_fields=["message", "latest_fetched_item_id", "message_type"]
                )
                metrics.incr("tempest.latest_id.success", tags={**tags, "result": "found"})
                return
        elif "error" in result:
            error_type = result["error"].get("type", "unknown")
            metrics.incr(
                "tempest.latest_id.error",
                tags={**tags, "error_type": error_type, "status_code": str(response.status_code)},
            )

            if error_type == "invalid_credentials":
                credentials.message = "Seems like the provided credentials are invalid"
                credentials.message_type = MessageType.ERROR
                credentials.save(update_fields=["message", "message_type"])
                return

            elif error_type == "ip_not_allowlisted":
                credentials.message = "Seems like our IP is not allow-listed"
                credentials.message_type = MessageType.ERROR
                credentials.save(update_fields=["message", "message_type"])
                return

        # Default in case things go wrong
        metrics.incr(
            "tempest.latest_id.error",
            tags={
                **tags,
                "error_type": "unexpected_response",
                "status_code": str(response.status_code),
            },
        )
        logger.error(
            "Fetching the latest item id failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "status_code": response.status_code,
                "response_text": result,
            },
        )

    except (Timeout, ReadTimeout) as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.latest_id.duration", duration_ms, tags=tags)
        metrics.incr("tempest.latest_id.error", tags={**tags, "error_type": "timeout"})
        logger.exception(
            "Fetching the latest item id timed out.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "duration_ms": duration_ms,
                "error": str(e),
            },
        )

    except ConnectionError as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.latest_id.duration", duration_ms, tags=tags)
        metrics.incr("tempest.latest_id.error", tags={**tags, "error_type": "connection_error"})
        logger.exception(
            "Fetching the latest item id failed due to connection error.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "duration_ms": duration_ms,
                "error": str(e),
            },
        )

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.latest_id.duration", duration_ms, tags=tags)
        metrics.incr("tempest.latest_id.error", tags={**tags, "error_type": "exception"})
        logger.exception(
            "Fetching the latest item id failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "duration_ms": duration_ms,
                "error": str(e),
            },
        )


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest_crashes",
    namespace=tempest_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def poll_tempest_crashes(credentials_id: int, **kwargs) -> None:
    # Lock duration should be slightly longer than the task deadline to prevent
    # overlapping tasks for the same credential. If a task is still running when
    # the next poll_tempest fires, the new task will skip this credential.
    lock_duration = options.get("tempest.task-deadline-seconds") + options.get(
        "tempest.lock-buffer-seconds"
    )
    lock = locks.get(
        f"tempest:poll_crashes:{credentials_id}",
        duration=lock_duration,
        name="tempest_poll_crashes",
    )
    try:
        with lock.acquire():
            _poll_tempest_crashes_impl(credentials_id)
    except UnableToAcquireLock:
        # Another task is already processing this credential, skip silently.
        # This is expected when tasks take longer than the polling interval.
        metrics.incr("tempest.crashes.skipped", tags={"reason": "lock_held"})


def _poll_tempest_crashes_impl(credentials_id: int) -> None:
    """Implementation of poll_tempest_crashes, separated for locking."""
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id
    client_id = credentials.client_id

    sentry_sdk.set_user({"id": f"{org_id}-{project_id}"})
    tags = {"org_id": str(org_id), "project_id": str(project_id)}

    start_time = time.time()
    batch_limit = options.get("tempest.poll-limit")

    try:
        if credentials.latest_fetched_item_id is not None:
            # This should generate/fetch a dsn explicitly for using with Tempest.
            project_key, created = ProjectKey.objects.get_or_create(
                use_case=UseCase.TEMPEST, project=credentials.project
            )
            dsn = project_key.get_dsn()
            if created:
                schedule_invalidate_project_config(
                    project_id=project_id, trigger="tempest:poll_tempest_crashes"
                )

            # Check if we should attach screenshots (opt-in feature)
            attach_screenshot = credentials.project.get_option("sentry:tempest_fetch_screenshots")

            response = fetch_items_from_tempest(
                org_id=org_id,
                project_id=project_id,
                client_id=client_id,
                client_secret=credentials.client_secret,
                dsn=dsn,
                offset=int(credentials.latest_fetched_item_id),
                limit=batch_limit,
                attach_screenshot=attach_screenshot,
                attach_dump=True,  # Always fetch for symbolication
            )
        else:
            raise ValueError(
                f"Unexpected None latest_fetched_item_id for credentials {credentials_id}. "
                "This should never happen as poll_tempest_crashes should only be called "
                "when latest_fetched_item_id is set."
            )

        # Record timing and response metrics
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.crashes.duration", duration_ms, tags=tags)
        metrics.distribution(
            "tempest.crashes.response_size_bytes",
            len(response.content),
            tags=tags,
        )

        result = response.json()

        # Track how many crashes were fetched
        crash_count = result.get("crash_count", 0)
        crash_fails = result.get("crash_fails", 0)
        metrics.distribution("tempest.crashes.batch_size", crash_count, tags=tags)
        if crash_fails > 0:
            metrics.incr("tempest.crashes.batch_failures", amount=crash_fails, tags=tags)

        credentials.latest_fetched_item_id = result["latest_id"]
        # Make sure that once existing customers pull crashes the message is set to SUCCESS,
        # since due to legacy reasons they might still have an empty ERROR message.
        credentials.message = ""
        credentials.message_type = MessageType.SUCCESS
        credentials.save(update_fields=["latest_fetched_item_id", "message", "message_type"])

        metrics.incr("tempest.crashes.success", tags=tags)

    except (Timeout, ReadTimeout) as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.crashes.duration", duration_ms, tags=tags)
        metrics.incr("tempest.crashes.error", tags={**tags, "error_type": "timeout"})
        logger.exception(
            "Fetching the crashes timed out.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "latest_id": credentials.latest_fetched_item_id,
                "duration_ms": duration_ms,
                "batch_limit": batch_limit,
                "error": str(e),
            },
        )
        # Don't reset latest_fetched_item_id on timeout - it's likely a transient issue
        # and we should retry with the same offset

    except ConnectionError as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.crashes.duration", duration_ms, tags=tags)
        metrics.incr("tempest.crashes.error", tags={**tags, "error_type": "connection_error"})
        logger.exception(
            "Fetching the crashes failed due to connection error.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "latest_id": credentials.latest_fetched_item_id,
                "duration_ms": duration_ms,
                "batch_limit": batch_limit,
                "error": str(e),
            },
        )
        # Don't reset latest_fetched_item_id on connection error - retry with same offset

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        metrics.timing("tempest.crashes.duration", duration_ms, tags=tags)
        metrics.incr("tempest.crashes.error", tags={**tags, "error_type": "exception"})
        logger.exception(
            "Fetching the crashes failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "latest_id": credentials.latest_fetched_item_id,
                "duration_ms": duration_ms,
                "batch_limit": batch_limit,
                "error": str(e),
            },
        )

        # Fetching crashes can fail if the CRS returns unexpected data.
        # In this case retrying does not help since we will just keep failing.
        # To avoid this we skip over the bad crash by setting the latest fetched id to
        # `None` such that in the next iteration of the job we first fetch the latest ID again.
        credentials.latest_fetched_item_id = None
        credentials.save(update_fields=["latest_fetched_item_id"])


def fetch_latest_id_from_tempest(
    org_id: int, project_id: int, client_id: str, client_secret: str
) -> Response:
    payload = {
        "org_id": org_id,
        "project_id": project_id,
        "client_id": client_id,
        "client_secret": client_secret,
    }

    timeout = options.get("tempest.latest-id-timeout")

    with sentry_sdk.start_span(op="http.client", description="POST /latest-id") as span:
        span.set_data("tempest.org_id", org_id)
        span.set_data("tempest.project_id", project_id)
        span.set_data("tempest.timeout", timeout)

        response = requests.post(
            url=settings.SENTRY_TEMPEST_URL + "/latest-id",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=timeout,
        )

        span.set_data("http.status_code", response.status_code)
        span.set_data("http.response_content_length", len(response.content))
        span.set_data("tempest.response_text", response.text[:1000])  # Truncate for safety

    return response


def fetch_items_from_tempest(
    org_id: int,
    project_id: int,
    client_id: str,
    client_secret: str,
    dsn: str,
    offset: int,
    limit: int = 10,
    attach_screenshot: bool = False,
    attach_dump: bool = True,
) -> Response:
    payload = {
        "org_id": org_id,
        "project_id": project_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "dsn": dsn,
        "offset": offset,
        "limit": limit,
        "attach_screenshot": attach_screenshot,
        "attach_dump": attach_dump,
    }

    timeout = options.get("tempest.crashes-timeout")

    with sentry_sdk.start_span(op="http.client", description="POST /crashes") as span:
        span.set_data("tempest.org_id", org_id)
        span.set_data("tempest.project_id", project_id)
        span.set_data("tempest.offset", offset)
        span.set_data("tempest.limit", limit)
        span.set_data("tempest.attach_screenshot", attach_screenshot)
        span.set_data("tempest.attach_dump", attach_dump)
        span.set_data("tempest.timeout", timeout)

        response = requests.post(
            url=settings.SENTRY_TEMPEST_URL + "/crashes",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=timeout,
        )

        span.set_data("http.status_code", response.status_code)
        span.set_data("http.response_content_length", len(response.content))
        # Don't log full response for crashes - it can be huge
        span.set_data("tempest.response_preview", response.text[:500])

    return response
