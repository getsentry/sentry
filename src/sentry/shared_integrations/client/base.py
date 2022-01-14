from random import random

import sentry_sdk
from django.core.cache import cache
from requests.exceptions import ConnectionError, HTTPError, Timeout

from sentry.http import build_session
from sentry.utils import json, metrics
from sentry.utils.hashlib import md5_text

from ..exceptions import ApiError, ApiHostError, ApiTimeoutError
from ..response.base import BaseApiResponse
from ..track_response import TrackResponseMixin


class BaseApiClient(TrackResponseMixin):
    base_url = None

    allow_text = False

    allow_redirects = None

    integration_type = None

    log_path = None

    datadog_prefix = None

    cache_time = 900

    page_size = 100

    page_number_limit = 10

    def __init__(self, verify_ssl=True, logging_context=None):
        self.verify_ssl = verify_ssl
        self.logging_context = logging_context

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        # TODO(joshuarli): Look into reusing a SafeSession, and closing it here.
        #                  Don't want to make the change until I completely understand
        #                  urllib3 machinery + how we override it, possibly do this
        #                  along with urllib3 upgrade.
        pass

    def get_cache_prefix(self):
        return f"{self.integration_type}.{self.name}.client:"

    def build_url(self, path):
        if path.startswith("/"):
            if not self.base_url:
                raise ValueError(f"Invalid URL: {path}")
            return f"{self.base_url}{path}"
        return path

    def _request(
        self,
        method,
        path,
        headers=None,
        data=None,
        params=None,
        auth=None,
        json=True,
        allow_text=None,
        allow_redirects=None,
        timeout=None,
    ):

        if allow_text is None:
            allow_text = self.allow_text

        if allow_redirects is None:
            allow_redirects = self.allow_redirects

        if allow_redirects is None:  # is still None
            allow_redirects = method.upper() == "GET"

        if timeout is None:
            timeout = 30

        full_url = self.build_url(path)

        metrics.incr(
            f"{self.datadog_prefix}.http_request",
            sample_rate=1.0,
            tags={self.integration_type: self.name},
        )

        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http",
            name=f"{self.integration_type}.http_response.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=random() < 0.05,
        ) as span:
            try:
                with build_session() as session:
                    resp = getattr(session, method.lower())(
                        url=full_url,
                        headers=headers,
                        json=data if json else None,
                        data=data if not json else None,
                        params=params,
                        auth=auth,
                        verify=self.verify_ssl,
                        allow_redirects=allow_redirects,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
            except ConnectionError as e:
                self.track_response_data("connection_error", span, e)
                raise ApiHostError.from_exception(e)
            except Timeout as e:
                self.track_response_data("timeout", span, e)
                raise ApiTimeoutError.from_exception(e)
            except HTTPError as e:
                resp = e.response
                if resp is None:
                    self.track_response_data("unknown", span, e)
                    self.logger.exception(
                        "request.error", extra={self.integration_type: self.name, "url": full_url}
                    )
                    raise ApiError("Internal Error", url=full_url)
                self.track_response_data(resp.status_code, span, e)
                raise ApiError.from_response(resp, url=full_url)

            self.track_response_data(resp.status_code, span, None, resp)

            if resp.status_code == 204:
                return {}

            return BaseApiResponse.from_response(resp, allow_text=allow_text)

    # subclasses should override ``request``
    def request(self, *args, **kwargs):
        return self._request(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request("DELETE", *args, **kwargs)

    def _get_cached(self, path: str, method: str, *args, **kwargs):
        query = ""
        if kwargs.get("params", None):
            query = json.dumps(kwargs.get("params"), sort_keys=True)
        key = self.get_cache_prefix() + md5_text(self.build_url(path), query).hexdigest()

        result = cache.get(key)
        if result is None:
            result = self.request(method, path, *args, **kwargs)
            cache.set(key, result, self.cache_time)
        return result

    def get_cached(self, path, *args, **kwargs):
        return self._get_cached(path, "GET", *args, **kwargs)

    def get(self, *args, **kwargs):
        return self.request("GET", *args, **kwargs)

    def patch(self, *args, **kwargs):
        return self.request("PATCH", *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request("POST", *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request("PUT", *args, **kwargs)

    def head(self, *args, **kwargs):
        return self.request("HEAD", *args, **kwargs)

    def head_cached(self, path, *args, **kwargs):
        return self._get_cached(path, "HEAD", *args, **kwargs)

    def get_with_pagination(self, path, gen_params, get_results, *args, **kwargs):
        page_size = self.page_size
        offset = 0
        output = []

        for i in range(self.page_number_limit):
            resp = self.get(path, params=gen_params(i, page_size))
            results = get_results(resp)
            num_results = len(results)

            output += results
            offset += num_results
            # if the number is lower than our page_size, we can quit
            if num_results < page_size:
                return output
        return output
