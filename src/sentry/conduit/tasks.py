import datetime
import logging
import time
from functools import partial
from uuid import uuid4

import requests
import sentry_sdk
from django.conf import settings
from google.protobuf.struct_pb2 import Struct
from google.protobuf.timestamp_pb2 import Timestamp
from requests import Response
from requests.exceptions import RequestException
from sentry_protos.conduit.v1alpha.publish_pb2 import Phase, PublishRequest

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import conduit_tasks
from sentry.utils import jwt
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger(__name__)

PUBLISH_REQUEST_TIMEOUT_SECONDS = 5
PUBLISH_REQUEST_MAX_RETRIES = 5
NUM_DELTAS = 100
SEND_INTERVAL_SECONDS = 0.15
JWT_EXPIRATION_SECONDS = 300  # 5 minutes
TASK_PROCESSING_DEADLINE_SECONDS = 60 * 3  # 3 minutes


@instrumented_task(
    name="sentry.conduit.tasks.stream_demo_data",
    namespace=conduit_tasks,
    processing_deadline_duration=TASK_PROCESSING_DEADLINE_SECONDS,
    silo_mode=SiloMode.REGION,
)
def stream_demo_data(org_id: int, channel_id: str) -> None:
    """Asynchronously stream data to Conduit."""
    try:
        token = generate_jwt(subject="demo")
    except ValueError as e:
        sentry_sdk.capture_exception(e, level="warning")
        return
    logger.info(
        "conduit.stream_demo_data.started", extra={"org_id": org_id, "channel_id": channel_id}
    )
    sequence = 0
    start_publish_request = PublishRequest(
        channel_id=channel_id,
        message_id=str(uuid4()),
        sequence=sequence,
        client_timestamp=get_timestamp(),
        phase=Phase.PHASE_START,
    )
    publish_data(org_id, start_publish_request, token)
    sequence += 1

    for i in range(NUM_DELTAS):
        payload = Struct()
        payload.update({"value": str(i)})
        delta_publish_request = PublishRequest(
            channel_id=channel_id,
            message_id=str(uuid4()),
            sequence=sequence,
            client_timestamp=get_timestamp(),
            phase=Phase.PHASE_DELTA,
            payload=payload,
        )
        publish_data(org_id, delta_publish_request, token)
        sequence += 1
        time.sleep(SEND_INTERVAL_SECONDS)

    end_publish_request = PublishRequest(
        channel_id=channel_id,
        message_id=str(uuid4()),
        sequence=sequence,
        client_timestamp=get_timestamp(),
        phase=Phase.PHASE_END,
    )
    publish_data(org_id, end_publish_request, token)
    logger.info(
        "conduit.stream_demo_data.ended", extra={"org_id": org_id, "channel_id": channel_id}
    )


def generate_jwt(
    subject: str, issuer: str | None = None, audience: str | None = None, secret: str | None = None
) -> str:
    """
    Generate a JWT token for the Conduit publish API.

    Uses HS256 algorithm with a 5 minute expiration.
    """
    if issuer is None:
        issuer = settings.CONDUIT_PUBLISH_JWT_ISSUER
    if audience is None:
        audience = settings.CONDUIT_PUBLISH_JWT_AUDIENCE
    if secret is None:
        secret = settings.CONDUIT_PUBLISH_SECRET
        if secret is None:
            raise ValueError("CONDUIT_PUBLISH_SECRET not configured")
    claims = {
        "sub": subject,
        "iss": issuer,
        "aud": audience,
        "exp": int(time.time()) + JWT_EXPIRATION_SECONDS,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def should_retry_publish(attempt: int, exception: Exception) -> bool:
    return attempt < PUBLISH_REQUEST_MAX_RETRIES and isinstance(exception, RequestException)


publish_retry_policy = ConditionalRetryPolicy(
    should_retry_publish,
    exponential_delay(0.5),
)


def publish_data(
    org_id: int,
    publish_request: PublishRequest,
    token: str,
    publish_url: str | None = None,
) -> Response:
    """
    Publish a protobuf message to Conduit with retries.

    Retries up to 5 times with exponential backoff.
    """
    if publish_url is None:
        publish_url = settings.CONDUIT_PUBLISH_URL
    return publish_retry_policy(
        partial(
            _do_publish,
            org_id=org_id,
            publish_request=publish_request,
            token=token,
            publish_url=publish_url,
        )
    )


def _do_publish(
    org_id: int,
    publish_request: PublishRequest,
    token: str,
    publish_url: str,
) -> Response:
    response = requests.post(
        url=f"{publish_url}/publish/{org_id}/{publish_request.channel_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-protobuf",
        },
        data=publish_request.SerializeToString(),
        timeout=PUBLISH_REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response


def get_timestamp(dt: datetime.datetime | None = None) -> Timestamp:
    if dt is None:
        dt = datetime.datetime.now(datetime.UTC)
    timestamp = Timestamp()
    timestamp.FromDatetime(dt)
    return timestamp
