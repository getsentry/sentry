from __future__ import annotations

from contextlib import nullcontext
from random import random
from typing import Any, Callable, Mapping, Sequence, Type, Union

import sentry_sdk
from django.core.cache import cache
from requests import PreparedRequest, Request, Response
from requests.exceptions import ConnectionError, HTTPError, Timeout

from sentry.http import build_session
from sentry.utils import json, metrics
from sentry.utils.hashlib import md5_text

from ..exceptions import ApiConnectionResetError, ApiHostError, ApiTimeoutError
from ..exceptions.base import ApiError
from ..response.base import BaseApiResponse
from ..track_response import TrackResponseMixin

# TODO(mgaeta): HACK Fix the line where _request() returns "{}".
BaseApiResponseX = Union[BaseApiResponse, Mapping[str, Any], Response]


class BaseApiClient(TrackResponseMixin):
    base_url: str | None = None

    allow_text = False

    allow_redirects: bool | None = None

    integration_type: str | None = None

    log_path: str | None = None

    metrics_prefix: str | None = None

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

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Allows subclasses to add hooks before sending requests out
        """
        return prepared_request

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
        prepared_request: PreparedRequest | None = None,
        raw_response: bool = False,
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
            f"{self.metrics_prefix}.http_request",
            sample_rate=1.0,
            tags={str(self.integration_type): self.name},
        )

        parent_span_id = None
        trace_id = None
        currently_in_server_transaction = False
        existing_transaction = None

        with sentry_sdk.configure_scope() as scope:
            if self.integration_type:
                scope.set_tag(self.integration_type, self.name)

            if scope.span is not None:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
                currently_in_server_transaction = (
                    scope.transaction and scope.transaction.op == sentry_sdk.consts.OP.HTTP_SERVER
                )
                if not currently_in_server_transaction and scope.transaction:
                    existing_transaction = {
                        "name": scope.transaction.name,
                        "op": scope.transaction.op,
                    }

        request = Request(
            method=method.upper(),
            url=full_url,
            headers=headers,
            json=data if json else None,
            data=data if not json else None,
            params=params,
            auth=auth,
        )
        _prepared_request = prepared_request if prepared_request is not None else request.prepare()

        with (
            sentry_sdk.start_transaction(
                op=f"{self.integration_type}.http",
                name=f"{self.integration_type}.http_response.{self.name}",
                parent_span_id=parent_span_id,
                trace_id=trace_id,
                sampled=random() < 0.05,
            )
            if not currently_in_server_transaction
            # `nullcontext()` results in `span` being None. (We do this so that any spans or errors
            # created attach themselves to the `http.server` transaction already in progress.)
            else nullcontext()
        ) as span:
            # TODO: Examine the values we get back here to decide if there are any other
            # existing transactions we should just let keep going rather than creating a new
            # transaction here
            if span and existing_transaction:
                span.set_data("existing_transaction", existing_transaction)

            try:
                with build_session() as session:
                    finalized_request = self.finalize_request(_prepared_request)
                    resp: Response = session.send(
                        finalized_request,
                        allow_redirects=allow_redirects,
                        timeout=timeout,
                        verify=self.verify_ssl,
                    )
                    if raw_response:
                        return resp
                    resp.raise_for_status()
            except ConnectionError as e:
                self.track_response_data("connection_error", span, e)
                raise ApiHostError.from_exception(e) from e
            except Timeout as e:
                self.track_response_data("timeout", span, e)
                raise ApiTimeoutError.from_exception(e) from e
            except HTTPError as e:
                error_resp = e.response
                if error_resp is None:
                    self.track_response_data("unknown", span, e)

                    # It shouldn't be possible for integration_type to be null.
                    extra = {"url": full_url}
                    if self.integration_type:
                        extra[self.integration_type] = self.name
                    self.logger.exception("request.error", extra=extra)

                    raise ApiError("Internal Error", url=full_url) from e
                self.track_response_data(error_resp.status_code, span, e)
                raise ApiError.from_response(error_resp, url=full_url) from e

            except Exception as e:
                # Sometimes a ConnectionResetError shows up two or three deep in an exception
                # chain, and you end up with an exception like
                #     `ChunkedEncodingError("Connection broken: ConnectionResetError(104, 'Connection reset by peer')",
                #          ConnectionResetError(104, 'Connection reset by peer'))`,
                # which is a ChunkedEncodingError caused by a ProtocolError caused by a ConnectionResetError.
                # Rather than worrying about what the other layers might be, we just stringify to detect this.
                if "ConnectionResetError" in str(e):
                    self.track_response_data("connection_reset_error", span, e)
                    raise ApiConnectionResetError("Connection reset by peer", url=full_url) from e
                # The same thing can happen with an InvalidChunkLength exception, which is a subclass of HTTPError
                if "InvalidChunkLength" in str(e):
                    self.track_response_data("invalid_chunk_length", span, e)
                    raise ApiError("Connection broken: invalid chunk length", url=full_url) from e

                # If it's not something we recognize, let the caller deal with it
                raise e

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
            query = json.dumps(kwargs.get("params"))
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
