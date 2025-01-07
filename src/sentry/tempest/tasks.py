import logging

from sentry import http
from sentry.models.projectkey import ProjectKey, UseCase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tempest.models import TempestCredentials
from sentry.utils import json

TEMPEST_URL = ""  # FIXME: Set this value once we have it
POLL_LIMIT = 348  # 348 every 5 min ~ 100k a day


logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest",
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=4 * 60,
    time_limit=4 * 60 + 5,
)
def poll_tempest(**kwargs):
    # FIXME: Once we have more traffic this needs to be done smarter.
    for credentials in TempestCredentials.objects.all():
        if credentials.latest_fetched_item_id is None:
            fetch_latest_item_id.delay(credentials.id)
        else:
            poll_tempest_crashes.delay(credentials.id)


@instrumented_task(
    name="sentry.tempest.tasks.fetch_latest_item_id",
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=1 * 60,
    time_limit=1 * 60 + 5,
)
def fetch_latest_item_id(credentials_id: int) -> None:
    # FIXME: Try catch this later
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id  # this should work?
    client_id = credentials.client_id

    try:
        response_text = fetch_latest_id_from_tempest(
            org_id=org_id,
            project_id=project_id,
            client_id=client_id,
            client_secret=credentials.client_secret,
        )

        if response_text.isdigit():  # If response is a number the fetch was a success
            credentials.latest_fetched_item_id = response_text
            credentials.save(update_fields=["latest_fetched_item_id"])
            return

        # Things the user ought to know about
        if response_text.startswith("Invalid credentials"):
            credentials.message = "Seems like the provided credentials are invalid"
            credentials.save(update_fields=["message"])
            return
        if response_text.startswith("IP address not allow-listed"):
            credentials.message = "Seems like our IP is not allow-listed"
            credentials.save(update_fields=["message"])
            return

        logger.info(
            "Fetching the latest item id failed.",
            extra={"org_id": org_id, "project_id": project_id, "client_id": client_id},
        )
    except Exception:
        logger.info(
            "Fetching the latest item id failed.",
            extra={"org_id": org_id, "project_id": project_id, "client_id": client_id},
        )


@instrumented_task(
    name="sentry.tempest.tasks.poll_tempest_crashes",
    queue="tempest",
    silo_mode=SiloMode.REGION,
    soft_time_limit=4 * 60,
    time_limit=4 * 60 + 5,
)
def poll_tempest_crashes(credentials_id: int) -> None:
    # FIXME: Try catch this later
    credentials = TempestCredentials.objects.select_related("project").get(id=credentials_id)
    project_id = credentials.project.id
    org_id = credentials.project.organization_id  # this should work?
    client_id = credentials.client_id

    try:
        # This does generate a dsn not sure if it will work in the grand scheme of things though.
        dsn = ProjectKey.objects.get_or_create(
            use_case=UseCase.TEMPEST, project=credentials.project
        )[0].get_dsn()
        response_text = fetch_items_from_tempest(
            org_id=org_id,
            project_id=project_id,
            client_id=client_id,
            client_secret=credentials.client_secret,
            dsn=dsn,
            offset=int(
                credentials.latest_fetched_item_id
            ),  # Need to convert here because it is a char in the DB
        )

        try:
            result = json.loads(response_text)
            credentials.latest_fetched_item_id = result[
                "latest_id"
            ]  # TODO: Not sure why this conversion works
            credentials.save(update_fields=["latest_fetched_item_id"])
        except json.JSONDecodeError:
            logger.info(
                "Fetching the crashes failed.",
                extra={
                    "org_id": org_id,
                    "project_id": project_id,
                    "client_id": client_id,
                    "latest_id": credentials.latest_fetched_item_id,
                    "error": response_text,
                },
            )
    except Exception:
        logger.info(
            "Fetching the crashes failed.",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "client_id": client_id,
                "latest_id": credentials.latest_fetched_item_id,
            },
        )


def fetch_latest_id_from_tempest(
    org_id: int, project_id: int, client_id: str, client_secret: str
) -> str:
    payload = {
        "org_id": org_id,
        "project_id": project_id,
        "client_id": client_id,
        "client_secret": client_secret,
    }

    response = http.safe_urlopen(
        url=TEMPEST_URL + "/latest-id",
        method="POST",
        headers={"Content-Type": "application/json"},
        json=payload,
    )
    return response.text


def fetch_items_from_tempest(
    org_id: int,
    project_id: int,
    client_id: str,
    client_secret: str,
    dsn: str,
    offset: int,
    limit: int = POLL_LIMIT,
    attach_screenshot: bool = False,
    time_out: int = 120,
) -> str:
    payload = {
        "org_id": org_id,
        "project_id": project_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "dsn": dsn,
        "offset": offset,
        "limit": limit,
        "attach_screenshot": attach_screenshot,
    }

    response = http.safe_urlopen(
        url=TEMPEST_URL + "/crashes",
        method="POST",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=time_out,
    )
    return response.text
