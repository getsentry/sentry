from __future__ import annotations

import dataclasses
import logging
import random
import time
import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Callable
from urllib.parse import urljoin

import sentry_sdk
from django.conf import settings
from requests.exceptions import RequestException

from sentry import options
from sentry.lang.native.sources import (
    get_bundle_index_urls,
    get_internal_artifact_lookup_source,
    get_scraping_config,
    sources_for_symbolication,
)
from sentry.models.project import Project
from sentry.net.http import Session
from sentry.utils import json, metrics

MAX_ATTEMPTS = 3

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SymbolicatorTaskKind:
    is_js: bool = False
    is_low_priority: bool = False
    is_reprocessing: bool = False

    def with_low_priority(self, is_low_priority: bool) -> SymbolicatorTaskKind:
        return dataclasses.replace(self, is_low_priority=is_low_priority)

    def with_js(self, is_js: bool) -> SymbolicatorTaskKind:
        return dataclasses.replace(self, is_js=is_js)


class SymbolicatorPools(Enum):
    default = "default"
    js = "js"
    lpq = "lpq"
    lpq_js = "lpq_js"


class Symbolicator:
    def __init__(
        self,
        task_kind: SymbolicatorTaskKind,
        on_request: Callable[[], None],
        project: Project,
        event_id: str,
    ):
        URLS = settings.SYMBOLICATOR_POOL_URLS
        pool = SymbolicatorPools.default.value
        if task_kind.is_low_priority:
            if task_kind.is_js:
                pool = SymbolicatorPools.lpq_js.value
            else:
                pool = SymbolicatorPools.lpq.value
        elif task_kind.is_js:
            pool = SymbolicatorPools.js.value

        base_url = (
            URLS.get(pool)
            or URLS.get(SymbolicatorPools.default.value)
            or options.get("symbolicator.options")["url"]
        )
        base_url = base_url.rstrip("/")
        assert base_url

        self.base_url = base_url
        self.on_request = on_request
        self.project = project
        self.event_id = event_id

    def _process(self, task_name: str, path: str, **kwargs):
        """
        This function will submit a symbolication task to a Symbolicator and handle
        polling it using the `SymbolicatorSession`.
        It will also correctly handle `TaskIdNotFound` and `ServiceUnavailable` errors.
        """
        session = SymbolicatorSession(
            url=self.base_url,
            project_id=str(self.project.id),
            event_id=str(self.event_id),
            timeout=settings.SYMBOLICATOR_POLL_TIMEOUT,
        )

        task_id: str | None = None
        json_response = None

        with session:
            while True:
                try:
                    if not task_id:
                        # We are submitting a new task to Symbolicator
                        json_response = session.create_task(path, **kwargs)
                    else:
                        # The task has already been submitted to Symbolicator and we are polling
                        json_response = session.query_task(task_id)
                except TaskIdNotFound:
                    # We have started a task on Symbolicator and are polling, but the task went away.
                    # This can happen when Symbolicator was restarted or the load balancer routing changed in some way.
                    # We can just re-submit the task using the same `session` and try again. We use the same `session`
                    # to avoid the likelihood of this happening again. When Symbolicators are restarted due to a deploy
                    # in a staggered fashion, we do not want to create a new `session`, being assigned a different
                    # Symbolicator instance just to it restarted next.
                    task_id = None
                    continue
                except ServiceUnavailable:
                    # This error means that the Symbolicator instance bound to our `session` is not healthy.
                    # By resetting the `worker_id`, the load balancer will route us to a different
                    # Symbolicator instance.
                    session.reset_worker_id()
                    task_id = None
                    continue
                finally:
                    self.on_request()

                metrics.incr(
                    "events.symbolicator.response",
                    tags={
                        "response": json_response.get("status") or "null",
                        "task_name": task_name,
                    },
                )

                if json_response["status"] == "pending":
                    # Symbolicator was not able to process the whole task within one timeout period.
                    # Start polling using the `request_id`/`task_id`.
                    task_id = json_response["request_id"]
                    continue

                # Otherwise, we are done processing, yay
                return json_response

    def process_minidump(self, minidump):
        (sources, process_response) = sources_for_symbolication(self.project)
        scraping_config = get_scraping_config(self.project)
        data = {
            "sources": json.dumps(sources),
            "scraping": json.dumps(scraping_config),
            "options": '{"dif_candidates": true}',
        }

        res = self._process(
            "process_minidump", "minidump", data=data, files={"upload_file_minidump": minidump}
        )
        return process_response(res)

    def process_applecrashreport(self, report):
        (sources, process_response) = sources_for_symbolication(self.project)
        scraping_config = get_scraping_config(self.project)
        data = {
            "sources": json.dumps(sources),
            "scraping": json.dumps(scraping_config),
            "options": '{"dif_candidates": true}',
        }

        res = self._process(
            "process_applecrashreport",
            "applecrashreport",
            data=data,
            files={"apple_crash_report": report},
        )
        return process_response(res)

    def process_payload(self, stacktraces, modules, signal=None, apply_source_context=True):
        (sources, process_response) = sources_for_symbolication(self.project)
        scraping_config = get_scraping_config(self.project)
        json = {
            "sources": sources,
            "options": {"dif_candidates": True, "apply_source_context": apply_source_context},
            "stacktraces": stacktraces,
            "modules": modules,
            "scraping": scraping_config,
        }

        if signal:
            json["signal"] = signal

        res = self._process("symbolicate_stacktraces", "symbolicate", json=json)
        return process_response(res)

    def process_js(self, stacktraces, modules, release, dist, apply_source_context=True):
        source = get_internal_artifact_lookup_source(self.project)
        scraping_config = get_scraping_config(self.project)

        json = {
            "source": source,
            "stacktraces": stacktraces,
            "modules": modules,
            "options": {"apply_source_context": apply_source_context},
            "scraping": scraping_config,
        }

        try:
            debug_id_index, url_index = get_bundle_index_urls(self.project, release, dist)
            if debug_id_index:
                json["debug_id_index"] = debug_id_index
            if url_index:
                json["url_index"] = url_index
        except Exception as e:
            sentry_sdk.capture_exception(e)

        if release is not None:
            json["release"] = release
        if dist is not None:
            json["dist"] = dist

        return self._process("symbolicate_js_stacktraces", "symbolicate-js", json=json)


class TaskIdNotFound(Exception):
    pass


class ServiceUnavailable(Exception):
    pass


class SymbolicatorSession:
    """
    The `SymbolicatorSession` is a glorified HTTP request wrapper that does the following things:

    - Maintains a `worker_id` which is used downstream in the load balancer for routing.
    - Maintains `timeout` parameters which are passed to Symbolicator.
    - Converts 404 and 503 errors into proper classes so they can be handled upstream.
    - Otherwise, it retries failed requests.
    """

    # Used as the `x-sentry-worker-id` HTTP header which is the routing key of
    # the Symbolicator load balancer.
    _worker_id = None

    def __init__(
        self,
        url=None,
        project_id=None,
        event_id=None,
        timeout=None,
    ):
        self.url = url
        self.project_id = project_id
        self.event_id = event_id
        self.timeout = timeout
        self.session = None
        self.worker_id = self._get_worker_id()

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

    def _request(self, method, path, **kwargs):
        if not self.session:
            raise RuntimeError("Session not opened")

        url = urljoin(self.url, path)

        # required for load balancing
        kwargs.setdefault("headers", {})["x-sentry-project-id"] = self.project_id
        kwargs.setdefault("headers", {})["x-sentry-event-id"] = self.event_id
        kwargs.setdefault("headers", {})["x-sentry-worker-id"] = self.worker_id

        attempts = 0
        wait = 0.5

        while True:
            try:
                with metrics.timer(
                    "events.symbolicator.session.request", tags={"attempt": attempts}
                ):
                    response = self.session.request(method, url, timeout=self.timeout + 1, **kwargs)

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
                    raise TaskIdNotFound()

                if response.status_code in (502, 503):
                    raise ServiceUnavailable()

                if response.ok:
                    json = response.json()

                    if json["status"] != "pending":
                        metrics.distribution(
                            "events.symbolicator.response.completed.size",
                            len(response.content),
                            unit="byte",
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
                    logger.exception("Failed to contact symbolicator")
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
        params = {"timeout": self.timeout, "scope": self.project_id}
        task_url = f"requests/{task_id}"

        with metrics.timer("events.symbolicator.query_task"):
            return self._request("get", task_url, params=params)

    @classmethod
    def _get_worker_id(cls) -> str:
        if random.random() <= options.get("symbolicator.worker-id-randomization-sample-rate"):
            return uuid.uuid4().hex

        # as class attribute to keep it static for life of process
        if cls._worker_id is None:
            # %5000 to reduce cardinality of metrics tagging with worker id
            cls._worker_id = str(uuid.uuid4().int % 5000)
        return cls._worker_id

    @classmethod
    def _reset_worker_id(cls):
        cls._worker_id = None

    def reset_worker_id(self):
        self._reset_worker_id()
        self.worker_id = self._get_worker_id()
