from __future__ import absolute_import

import six
import json

from django.conf import settings
from django.utils import timezone

from sentry.utils import redis
from sentry.models.sentryapp import VALID_EVENTS
from sentry.models import Organization

BUFFER_SIZE = 100


class SentryAppWebhookRequestsBuffer(object):
    """
    Create a data structure to store basic information about Sentry App webhook requests in Redis
    This should store the last 100 requests and last 100 errors (in different keys) for each event type, for each Sentry App
    """

    def __init__(self, sentry_app):
        self.sentry_app = sentry_app

        cluster_id = getattr(settings, "SENTRY_WEBHOOK_LOG_REDIS_CLUSTER", None)
        if cluster_id is None:
            self.client = redis.clusters.get("default").get_local_client(0)
        else:
            self.client = redis.redis_clusters.get(cluster_id)

    def _convert_redis_request(self, request, event):
        formatted_request = json.loads(request)
        if "organization_id" in formatted_request:
            org = Organization.objects.get(id=formatted_request["organization_id"])
            formatted_request["organization"] = {"name": org.name, "slug": org.slug}
            del formatted_request["organization_id"]

        formatted_request["event_type"] = event
        formatted_request["sentry_app_slug"] = self.sentry_app.slug

        return formatted_request

    def _add_to_buffer(self, buffer_key, item):
        self.client.lpush(buffer_key, json.dumps(item))
        self.client.ltrim(buffer_key, 0, BUFFER_SIZE - 1)

    def add_request(self, response_code, org_id, event, url):
        if event not in VALID_EVENTS:
            return

        request_key = self._get_redis_key(event)

        time = timezone.now()
        request_data = {
            "date": six.binary_type(time),
            "response_code": response_code,
            "organization_id": org_id,
            "webhook_url": url,
        }

        self._add_to_buffer(request_key, request_data)

        # If it's an error add it to the error buffer
        if not 200 <= response_code <= 299:
            error_key = self._get_redis_key(event, error=True)
            self._add_to_buffer(error_key, request_data)

    def _get_all_from_buffer(self, buffer_key):
        return self.client.lrange(buffer_key, 0, BUFFER_SIZE - 1)

    def _get_requests(self, event=None, error=False):
        # If no event is specified, return all
        if event is None:
            all_requests = []
            for evt in VALID_EVENTS:
                event_requests = [
                    self._convert_redis_request(request, evt)
                    for request in self._get_all_from_buffer(self._get_redis_key(evt, error=error))
                ]
                all_requests.extend(event_requests)

            return all_requests

        return [
            self._convert_redis_request(request, event)
            for request in self._get_all_from_buffer(self._get_redis_key(event, error=error))
        ]

    def get_errors(self, event=None):
        return self._get_requests(event=event, error=True)

    def get_requests(self, event=None):
        return self._get_requests(event=event, error=False)

    def _get_redis_key(self, event, error=False):
        sentry_app_id = self.sentry_app.id

        if error:
            return "sentry-app-webhook-error:{}:{}".format(sentry_app_id, event)
        else:
            return "sentry-app-webhook-request:{}:{}".format(sentry_app_id, event)
