import logging

import requests
import sentry_sdk
from django.conf import settings
from requests import Response

from sentry import options
from sentry.models.projectkey import ProjectKey, UseCase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.tempest.models import MessageType, TempestCredentials

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest",
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=55,
    time_limit=60,
)
def poll_tempest(**kwargs):
    # FIXME: Once we have more traffic this needs to be done smarter.
    for credentials in TempestCredentials.objects.all():
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
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=55,
    time_limit=60,
)
def fetch_latest_item_id(credentials_id: int, **kwargs) -> None:
    # FIXME: Try catch this later
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id
    client_id = credentials.client_id

    try:
        response = fetch_latest_id_from_tempest(
            org_id=org_id,
            project_id=project_id,
            client_id=client_id,
            client_secret=credentials.client_secret,
        )
        result = response.json()

        if "latest_id" in result:
            credentials.latest_fetched_item_id = result["latest_id"]
            credentials.message = ""
            credentials.message_type = MessageType.SUCCESS
            credentials.save(update_fields=["message", "latest_fetched_item_id", "message_type"])
            return
        elif "error" in result:
            if result["error"]["type"] == "invalid_credentials":
                credentials.message = "Seems like the provided credentials are invalid"
                credentials.message_type = MessageType.ERROR
                credentials.save(update_fields=["message", "message_type"])
                return

            elif result["error"]["type"] == "ip_not_allowlisted":
                credentials.message = "Seems like our IP is not allow-listed"
                credentials.message_type = MessageType.ERROR
                credentials.save(update_fields=["message", "message_type"])
                return

        # Default in case things go wrong
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

    except Exception as e:
        logger.exception(
            "Fetching the latest item id failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "error": str(e),
            },
        )


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest_crashes",
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=55,
    time_limit=60,
)
def poll_tempest_crashes(credentials_id: int, **kwargs) -> None:
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id
    client_id = credentials.client_id

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

            # Check if we should attach screenshots  and or dumps (opt-in features)
            attach_screenshot = credentials.project.get_option("sentry:tempest_fetch_screenshots")
            attach_dump = credentials.project.get_option("sentry:tempest_fetch_dumps")

            response = fetch_items_from_tempest(
                org_id=org_id,
                project_id=project_id,
                client_id=client_id,
                client_secret=credentials.client_secret,
                dsn=dsn,
                offset=int(credentials.latest_fetched_item_id),
                limit=options.get("tempest.poll-limit"),
                attach_screenshot=attach_screenshot,
                attach_dump=attach_dump,
            )
        else:
            raise ValueError(
                f"Unexpected None latest_fetched_item_id for credentials {credentials_id}. "
                "This should never happen as poll_tempest_crashes should only be called "
                "when latest_fetched_item_id is set."
            )

        result = response.json()
        credentials.latest_fetched_item_id = result["latest_id"]
        credentials.save(update_fields=["latest_fetched_item_id"])
    except Exception as e:
        logger.exception(
            "Fetching the crashes failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "latest_id": credentials.latest_fetched_item_id,
                "error": str(e),
            },
        )


def fetch_latest_id_from_tempest(
    org_id: int, project_id: int, client_id: str, client_secret: str
) -> Response:
    payload = {
        "org_id": org_id,
        "project_id": project_id,
        "client_id": client_id,
        "client_secret": client_secret,
    }

    response = requests.post(
        url=settings.SENTRY_TEMPEST_URL + "/latest-id",
        headers={"Content-Type": "application/json"},
        json=payload,
    )

    span = sentry_sdk.get_current_span()
    if span is not None:
        span.set_data("response_text", response.text)

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
    attach_dump: bool = False,
    time_out: int = 50,  # Since there is a timeout of 45s in the middleware anyways
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

    response = requests.post(
        url=settings.SENTRY_TEMPEST_URL + "/crashes",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=time_out,
    )

    span = sentry_sdk.get_current_span()
    if span is not None:
        span.set_data("response_text", response.text)

    return response
