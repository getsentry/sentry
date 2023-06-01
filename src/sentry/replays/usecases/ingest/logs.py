import logging
import random

from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.utils import metrics

logger = logging.getLogger()


def log_sdk_options(project_id: int, replay_id: str, event: SentryEvent) -> None:
    if random.randint(0, 499) < 1:
        log = event["data"].get("payload", {}).copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        logger.info("SDK Options:", extra=log)


def log_large_mutations(project_id: int, replay_id: str, event: SentryEvent) -> None:
    if random.randint(0, 99) < 1:
        log = event["data"].get("payload", {}).copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        logger.info("Large DOM Mutations List:", extra=log)


def log_slow_click(project_id: int, replay_id: str, event: SentryEvent) -> None:
    log = event["data"].get("payload", {}).copy()
    log["project_id"] = project_id
    log["replay_id"] = replay_id
    log["dom_tree"] = log.pop("message")
    logger.info("sentry.replays.slow_click", extra=log)


def log_request_response_sizes(event: SentryEvent) -> None:
    event_payload_data = event["data"]["payload"]["data"]

    # these first two cover SDKs 7.44 and 7.45
    if event_payload_data.get("requestBodySize"):
        metrics.timing(
            "replays.usecases.ingest.request_body_size",
            event_payload_data["requestBodySize"],
        )
    if event_payload_data.get("responseBodySize"):
        metrics.timing(
            "replays.usecases.ingest.response_body_size",
            event_payload_data["responseBodySize"],
        )

    # what the most recent SDKs send:
    if event_payload_data.get("request", {}).get("size"):
        metrics.timing(
            "replays.usecases.ingest.request_body_size",
            event_payload_data["request"]["size"],
        )
    if event_payload_data.get("response", {}).get("size"):
        metrics.timing(
            "replays.usecases.ingest.response_body_size",
            event_payload_data["response"]["size"],
        )
