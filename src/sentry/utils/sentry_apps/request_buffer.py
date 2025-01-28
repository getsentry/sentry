from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, NotRequired, TypedDict, overload

from dateutil.parser import parse as parse_date
from django.conf import settings
from django.utils import timezone
from redis.client import Pipeline
from requests.models import Response

from sentry.sentry_apps.models.sentry_app import VALID_EVENTS
from sentry.utils import json, redis

if TYPE_CHECKING:
    from sentry.sentry_apps.models.sentry_app import SentryApp
    from sentry.sentry_apps.services.app.model import RpcSentryApp

BUFFER_SIZE = 100
KEY_EXPIRY = 60 * 60 * 24 * 30  # 30 days

logger = logging.getLogger("sentry.utils.sentry_apps")

EXTENDED_VALID_EVENTS = VALID_EVENTS + (
    "event_alert.triggered",
    "external_issue.created",
    "external_issue.linked",
    "installation.created",
    "installation.deleted",
    "select_options.requested",
    "metric_alert.open",
    "metric_alert.resolved",
    "metric_alert.critical",
    "metric_alert.warning",
    "alert_rule_action.requested",
    "alert_rule_action.error",
)


class SentryAppRequest(TypedDict):
    date: str
    response_code: int
    webhook_url: str
    organization_id: int
    event_type: str
    error_id: NotRequired[str | None]
    project_id: NotRequired[int | None]
    request_body: NotRequired[str | None]
    request_headers: NotRequired[Mapping[str, str] | None]
    response_body: NotRequired[str | None]


class SentryAppWebhookRequestsBuffer:
    """
    Create a data structure to store basic information about Sentry App webhook requests in Redis
    This should store the last 100 requests and last 100 errors (in different keys) for each event type, for each Sentry App
    """

    def __init__(self, sentry_app: SentryApp | RpcSentryApp) -> None:
        self.sentry_app = sentry_app

        cluster_id = settings.SENTRY_WEBHOOK_LOG_REDIS_CLUSTER
        self.client = redis.redis_clusters.get(cluster_id)

    def _get_redis_key(self, event: str, error: bool = False) -> str:
        sentry_app_id = self.sentry_app.id

        if error:
            return f"sentry-app-webhook-error:{{{sentry_app_id}}}:{event}"
        else:
            return f"sentry-app-webhook-request:{{{sentry_app_id}}}:{event}"

    def _convert_redis_request(self, redis_request: str, event: str) -> SentryAppRequest:
        """
        Convert the request string stored in Redis to a python dict
        Add the event type to the dict so that the request can be identified correctly
        """
        request = json.loads(redis_request)
        request["event_type"] = event

        return request

    def _add_to_buffer_pipeline(
        self, buffer_key: str, item: object, pipeline: Pipeline[str]
    ) -> None:
        """
        Add the item to the buffer key specified, using the given pipeline.
        This does not execute the pipeline's commands.
        """

        pipeline.lpush(buffer_key, json.dumps(item))
        pipeline.ltrim(buffer_key, 0, BUFFER_SIZE - 1)
        pipeline.expire(buffer_key, KEY_EXPIRY)

    @overload
    def _get_all_from_buffer(self, buffer_key: str, pipeline: Pipeline[str]) -> None: ...

    @overload
    def _get_all_from_buffer(self, buffer_key: str) -> list[str]: ...

    def _get_all_from_buffer(
        self, buffer_key: str, pipeline: Pipeline[str] | None = None
    ) -> list[str] | None:
        """
        Get the list at the buffer key, using the given pipeline if available.
        If a pipeline is provided, this does not return a value as the pipeline must still be executed.
        """

        if pipeline is not None:
            pipeline.lrange(buffer_key, 0, BUFFER_SIZE - 1)
            return None
        else:
            return self.client.lrange(buffer_key, 0, BUFFER_SIZE - 1)

    def _get_requests(
        self, event: str | list[str] | None = None, error: bool = False
    ) -> list[SentryAppRequest]:
        if isinstance(event, str):
            return [
                self._convert_redis_request(request, event)
                for request in self._get_all_from_buffer(self._get_redis_key(event, error=error))
            ]
        # If no event is specified, return the latest requests/errors for all event types
        else:
            event_types = event or EXTENDED_VALID_EVENTS
            pipe = self.client.pipeline()

            all_requests: list[SentryAppRequest] = []
            for evt in event_types:
                self._get_all_from_buffer(self._get_redis_key(evt, error=error), pipeline=pipe)

            values = pipe.execute()

            for idx, evt in enumerate(event_types):
                event_requests = [
                    self._convert_redis_request(request, evt) for request in values[idx]
                ]
                all_requests.extend(event_requests)

            all_requests.sort(key=lambda x: parse_date(x["date"]), reverse=True)
            return all_requests[0:BUFFER_SIZE]

    def get_requests(
        self, event: str | list[str] | None = None, errors_only: bool = False
    ) -> list[SentryAppRequest]:
        return self._get_requests(event=event, error=errors_only)

    def add_request(
        self,
        response_code: int,
        org_id: int,
        event: str,
        url: str,
        error_id: str | None = None,
        project_id: int | None = None,
        response: Response | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        from sentry.utils.sentry_apps.webhooks import TIMEOUT_STATUS_CODE

        if event not in EXTENDED_VALID_EVENTS:
            logger.warning("Event %s is not a valid event that can be stored.", event)
            return

        request_key = self._get_redis_key(event)

        time = timezone.now()
        request_data = {
            "date": str(time),
            "response_code": response_code,
            "webhook_url": url,
        }
        MAX_SIZE = 1024
        if response_code >= 400 or response_code == TIMEOUT_STATUS_CODE:
            if headers:
                request_data["request_headers"] = headers

            if response is not None:
                if response.content is not None:
                    try:
                        json.loads(response.content)
                        # if the type is jsonifiable, treat it as such
                        prettified_response_body = json.dumps(response.content)
                        request_data["response_body"] = prettified_response_body[:MAX_SIZE]
                    except (json.JSONDecodeError, TypeError):
                        request_data["response_body"] = response.content[:MAX_SIZE]
                if response.request is not None:
                    request_body = response.request.body
                    if request_body is not None:
                        prettified_request_body = json.dumps(request_body)
                        request_data["request_body"] = prettified_request_body[:MAX_SIZE]

        # Don't store the org id for internal apps because it will always be the org that owns the app anyway
        if not self.sentry_app.is_internal:
            request_data["organization_id"] = org_id

        # We need both the error ID and project ID to link the error
        if error_id is not None and project_id is not None:
            request_data["error_id"] = error_id
            request_data["project_id"] = project_id

        pipe = self.client.pipeline()

        self._add_to_buffer_pipeline(request_key, request_data, pipe)

        # If it's an error add it to the error buffer
        if 400 <= response_code <= 599 or response_code == TIMEOUT_STATUS_CODE:
            error_key = self._get_redis_key(event, error=True)
            self._add_to_buffer_pipeline(error_key, request_data, pipe)

        pipe.execute()
