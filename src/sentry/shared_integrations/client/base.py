from __future__ import annotations

from random import random
from typing import Any, Callable, Mapping, Sequence, Type, Union

import sentry_sdk
from django.core.cache import cache
from requests.exceptions import ConnectionError, HTTPError, Timeout

from sentry.http import build_session
from sentry.utils import json, metrics
from sentry.utils.hashlib import md5_text

from ..exceptions import ApiHostError, ApiTimeoutError
from ..exceptions.base import ApiError
from ..response.base import BaseApiResponse
from ..track_response import TrackResponseMixin

# TODO(mgaeta): HACK Fix the line where _request() returns "{}".
BaseApiResponseX = Union[BaseApiResponse, Mapping[str, Any]]


class BaseApiClient(TrackResponseMixin):
    base_url: str | None = None

    allow_text = False

    allow_redirects: bool | None = None

    integration_type: str | None = None

    log_path: str | None = None

    datadog_prefix: str | None = None

    cache_time = 900

    page_size: int = 100

    page_number_limit = 10

    def __init__(
        self,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.verify_ssl = verify_ssl
        self.logging_context = logging_context

    def __enter__(self) -> BaseApiClient:
        return self

    def __exit__(self, exc_type: Type[Exception], exc_value: Exception, traceback: Any) -> None:
        # TODO(joshuarli): Look into reusing a SafeSession, and closing it here.
        #  Don't want to make the change until I completely understand urllib3
        #  machinery + how we override it, possibly do this along with urllib3
        #  upgrade.
        pass

    def get_cache_prefix(self) -> str:
        return f"{self.integration_type}.{self.name}.client:"

    def build_url(self, path: str) -> str:
        if path.startswith("/"):
            if not self.base_url:
                raise ValueError(f"Invalid URL: {path}")
            return f"{self.base_url}{path}"
        return path

    def _request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, str] | None = None,
        params: Mapping[str, str] | None = None,
        auth: str | None = None,
        json: bool = True,
        allow_text: bool | None = None,
        allow_redirects: bool | None = None,
        timeout: int | None = None,
        ignore_webhook_errors: bool = False,
    ) -> BaseApiResponseX:
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
            tags={str(self.integration_type): self.name},
        )

        with sentry_sdk.configure_scope() as scope:
            if scope.span is not None:
                parent_span_id: str | None = scope.span.span_id
                trace_id: str | None = scope.span.trace_id
            else:
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

                    # It shouldn't be possible for integration_type to be null.
                    extra = {"url": full_url}
                    if self.integration_type:
                        extra[self.integration_type] = self.name
                    self.logger.exception("request.error", extra=extra)

                    raise ApiError("Internal Error", url=full_url)
                self.track_response_data(resp.status_code, span, e)
                raise ApiError.from_response(resp, url=full_url)

            self.track_response_data(resp.status_code, span, None, resp)

            if resp.status_code == 204:
                return {}

            return BaseApiResponse.from_response(
                resp, allow_text=allow_text, ignore_webhook_errors=ignore_webhook_errors
            )

    # subclasses should override ``request``
    def request(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self._request(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("DELETE", *args, **kwargs)

    def _get_cached(self, path: str, method: str, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        query = ""
        if kwargs.get("params", None):
            query = json.dumps(kwargs.get("params"), sort_keys=True)
        key = self.get_cache_prefix() + md5_text(self.build_url(path), query).hexdigest()

        result: BaseApiResponseX | None = cache.get(key)
        if result is None:
            result = self.request(method, path, *args, **kwargs)
            cache.set(key, result, self.cache_time)
        return result

    def get_cached(self, path: str, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self._get_cached(path, "GET", *args, **kwargs)

    def get(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("GET", *args, **kwargs)

    def patch(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("PATCH", *args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("POST", *args, **kwargs)

    def put(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("PUT", *args, **kwargs)

    def head(self, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self.request("HEAD", *args, **kwargs)

    def head_cached(self, path: str, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        return self._get_cached(path, "HEAD", *args, **kwargs)

    def get_with_pagination(
        self,
        path: str,
        gen_params: Callable[..., Any],
        get_results: Callable[..., Any],
        *args: Any,
        **kwargs: Any,
    ) -> Sequence[BaseApiResponse]:
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
