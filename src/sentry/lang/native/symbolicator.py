import logging
import time
import uuid
from urllib.parse import urljoin

import sentry_sdk
from django.conf import settings
from requests.exceptions import RequestException

from sentry import options
from sentry.cache import default_cache
from sentry.lang.native.sources import get_internal_release_file_source, sources_for_symbolication
from sentry.models import Organization
from sentry.net.http import Session
from sentry.tasks.symbolication import RetrySymbolication
from sentry.utils import json, metrics

MAX_ATTEMPTS = 3
REQUEST_CACHE_TIMEOUT = 3600

logger = logging.getLogger(__name__)


def _task_id_cache_key_for_event(project_id, event_id):
    return f"symbolicator:{event_id}:{project_id}"


class Symbolicator:
    def __init__(self, project, event_id, release=None):
        symbolicator_options = options.get("symbolicator.options")
        base_url = symbolicator_options["url"].rstrip("/")
        assert base_url

        # needed for efficient featureflag checks in getsentry
        with sentry_sdk.start_span(op="lang.native.symbolicator.organization.get_from_cache"):
            project.set_cached_field_value(
                "organization", Organization.objects.get_from_cache(id=project.organization_id)
            )

        self.project = project
        self.release = release
        self.sess = SymbolicatorSession(
            url=base_url,
            project_id=str(project.id),
            event_id=str(event_id),
            timeout=settings.SYMBOLICATOR_POLL_TIMEOUT,
        )
        self.task_id_cache_key = _task_id_cache_key_for_event(project.id, event_id)

    def _process(self, task_name: str, path: str, **kwargs):
        task_id = default_cache.get(self.task_id_cache_key)
        json_response = None

        with self.sess:
            try:
                if task_id:
                    # Processing has already started and we need to poll
                    # symbolicator for an update. This in turn may put us back into
                    # the queue.
                    json_response = self.sess.query_task(task_id)

                if json_response is None:
                    # This is a new task, so we compute all request parameters
                    # (potentially expensive if we need to pull minidumps), and then
                    # upload all information to symbolicator. It will likely not
                    # have a response ready immediately, so we start polling after
                    # some timeout.
                    json_response = self.sess.create_task(path, **kwargs)
            except ServiceUnavailable:
                # 503 can indicate that symbolicator is restarting. Wait for a
                # reboot, then try again. This overrides the default behavior of
                # retrying after just a second.
                #
                # If there is no response attached, it's a connection error.
                raise RetrySymbolication(retry_after=settings.SYMBOLICATOR_MAX_RETRY_AFTER)

            metrics.incr(
                "events.symbolicator.response",
                tags={"response": json_response.get("status") or "null", "task_name": task_name},
            )

            # Symbolication is still in progress. Bail out and try again
            # after some timeout. Symbolicator keeps the response for the
            # first one to poll it.
            if json_response["status"] == "pending":
                default_cache.set(
                    self.task_id_cache_key, json_response["request_id"], REQUEST_CACHE_TIMEOUT
                )
                raise RetrySymbolication(retry_after=json_response["retry_after"])
            else:
                # Once we arrive here, we are done processing. Clean up the
                # task id from the cache.
                default_cache.delete(self.task_id_cache_key)
                return json_response

    def process_minidump(self, minidump):
        (sources, process_response) = sources_for_symbolication(self.project)
        data = {
            "sources": json.dumps(sources),
            "options": '{"dif_candidates": true}',
        }

        res = self._process(
            "process_minidump", "minidump", data=data, files={"upload_file_minidump": minidump}
        )
        return process_response(res)

    def process_applecrashreport(self, report):
        (sources, process_response) = sources_for_symbolication(self.project)
        data = {
            "sources": json.dumps(sources),
            "options": '{"dif_candidates": true}',
        }

        res = self._process(
            "process_applecrashreport",
            "applecrashreport",
            data=data,
            files={"apple_crash_report": report},
        )
        return process_response(res)

    def process_payload(self, stacktraces, modules, signal=None):
        (sources, process_response) = sources_for_symbolication(self.project)
        json = {
            "sources": sources,
            "options": {"dif_candidates": True},
            "stacktraces": stacktraces,
            "modules": modules,
        }

        if signal:
            json["signal"] = signal

        res = self._process("symbolicate_stacktraces", "symbolicate", json=json)
        return process_response(res)

    def process_js(self, stacktraces, modules, dist, allow_scraping=True):
        source = get_internal_release_file_source(self.project, self.release)

        json = {
            "source": source,
            "stacktraces": stacktraces,
            "modules": modules,
            "allow_scraping": allow_scraping,
        }

        if dist is not None:
            json["dist"] = dist

        return self._process("symbolicate_js_stacktraces", "symbolicate-js", json=json)


class TaskIdNotFound(Exception):
    pass


class ServiceUnavailable(Exception):
    pass


class SymbolicatorSession:

    # used in x-sentry-worker-id http header
    # to keep it static for celery worker process keep it as class attribute
    _worker_id = None

    def __init__(
        self, url=None, sources=None, project_id=None, event_id=None, timeout=None, options=None
    ):
        self.url = url
        self.project_id = project_id
        self.event_id = event_id
        self.sources = sources or []
        self.options = options or None
        self.timeout = timeout
        self.session = None

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, *args):
        self.close()

    def open(self):
        if self.session is None:
            self.session = Session()

    def close(self):
        if self.session is not None:
            self.session.close()
            self.session = None

    def _ensure_open(self):
        if not self.session:
            raise RuntimeError("Session not opened")

    def _request(self, method, path, **kwargs):
        self._ensure_open()

        url = urljoin(self.url, path)

        # required for load balancing
        kwargs.setdefault("headers", {})["x-sentry-project-id"] = self.project_id
        kwargs.setdefault("headers", {})["x-sentry-event-id"] = self.event_id
        kwargs.setdefault("headers", {})["x-sentry-worker-id"] = self.get_worker_id()

        attempts = 0
        wait = 0.5

        while True:
            try:
                with metrics.timer(
                    "events.symbolicator.session.request", tags={"attempt": attempts}
                ):
                    response = self.session.request(
                        method, url, timeout=settings.SYMBOLICATOR_POLL_TIMEOUT + 1, **kwargs
                    )

                metrics.incr(
                    "events.symbolicator.status_code",
                    tags={"status_code": response.status_code},
                )

                if (
                    method.lower() == "get"
                    and path.startswith("requests/")
                    and response.status_code == 404
                ):
                    # The symbolicator does not know this task. This is
                    # expected to happen when we're currently deploying
                    # symbolicator (which will clear all of its state). Re-send
                    # the symbolication task.
                    return None

                if response.status_code in (502, 503):
                    raise ServiceUnavailable()

                if response.ok:
                    json = response.json()

                    if json["status"] != "pending":
                        metrics.timing(
                            "events.symbolicator.response.completed.size", len(response.content)
                        )
                else:
                    with sentry_sdk.push_scope():
                        sentry_sdk.set_extra("symbolicator_response", response.text)
                        sentry_sdk.capture_message("Symbolicator request failed")

                    json = {"status": "failed", "message": "internal server error"}

                return json
            except (OSError, RequestException) as e:
                metrics.incr(
                    "events.symbolicator.request_error",
                    tags={
                        "exc": ".".join([e.__class__.__module__, e.__class__.__name__]),
                        "attempt": attempts,
                    },
                )

                attempts += 1
                # Any server error needs to be treated as a failure. We can
                # retry a couple of times, but ultimately need to bail out.
                #
                # This can happen for any network failure.
                if attempts > MAX_ATTEMPTS:
                    logger.error("Failed to contact symbolicator", exc_info=True)
                    raise

                time.sleep(wait)
                wait *= 2.0

    def create_task(self, path, **kwargs):
        params = {"timeout": self.timeout, "scope": self.project_id}
        with metrics.timer(
            "events.symbolicator.create_task",
            tags={"path": path},
        ):
            return self._request(method="post", path=path, params=params, **kwargs)

    def query_task(self, task_id):
        task_url = f"requests/{task_id}"

        params = {
            "timeout": 0,  # Only wait when creating, but not when querying tasks
            "scope": self.project_id,
        }

        with metrics.timer("events.symbolicator.query_task"):
            return self._request("get", task_url, params=params)

    def healthcheck(self):
        return self._request("get", "healthcheck")

    @classmethod
    def get_worker_id(cls):
        # as class attribute to keep it static for life of process
        if cls._worker_id is None:
            # %5000 to reduce cardinality of metrics tagging with worker id
            cls._worker_id = str(uuid.uuid4().int % 5000)
        return cls._worker_id
