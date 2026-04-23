from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from types import TracebackType
from typing import Any, Literal, NotRequired, Self, TypedDict, TypeVar, overload

import sentry_sdk
from django.core.cache import cache
from requests import PreparedRequest, Request, Response
from requests.adapters import RetryError
from requests.exceptions import ConnectionError, HTTPError, Timeout

from sentry.exceptions import RestrictedIPAddress
from sentry.http import build_session
from sentry.net.http import SafeSession
from sentry.utils import json, metrics
from sentry.utils.hashlib import md5_text

from ..exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiRetryError,
    ApiTimeoutError,
)
from ..response.base import BaseApiResponse


class SessionSettings(TypedDict):
    timeout: int
    allow_redirects: bool
    # the below are taken from session.merge_environment_settings
    proxies: NotRequired[MutableMapping[str, str]]
    stream: NotRequired[bool | None]
    verify: NotRequired[bool | str | None]
    cert: NotRequired[str | tuple[str, str] | None]


_TPaginatedResult = TypeVar("_TPaginatedResult")


class BaseApiClient:
    base_url: str = ""

    allow_redirects: bool | None = None

    integration_type: str  # abstract

    logger = logging.getLogger(__name__)

    metrics_prefix: str | None = None

    cache_time = 900

    page_size: int = 100

    page_number_limit = 10

    integration_name: str

    # Timeout for both the connect and the read timeouts.
    # See: https://requests.readthedocs.io/en/latest/user/advanced/#timeouts
    timeout: int = 30

    @property
    def name(self) -> str:
        return getattr(self, f"{self.integration_type}_name")

    def __init__(
        self,
        integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        self.verify_ssl = verify_ssl
        self.logging_context = logging_context
        self.integration_id = integration_id

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[Exception] | None,
        exc_value: Exception | None,
        traceback: TracebackType | None,
    ) -> None:
        # TODO(joshuarli): Look into reusing a SafeSession, and closing it here.
        #  Don't want to make the change until I completely understand urllib3
        #  machinery + how we override it, possibly do this along with urllib3
        #  upgrade.
        pass

    def track_response_data(
        self,
        code: str | int,
        error: Exception | None = None,
        resp: Response | None = None,
        extra: Mapping[str, str | int] | None = None,
    ) -> None:
        tags: dict[str, str | int] = {self.integration_type: self.name, "status": code}
        if extra and "api_request_type" in extra:
            tags["api_request_type"] = extra["api_request_type"]
        metrics.incr(
            f"{self.metrics_prefix}.http_response",
            sample_rate=1.0,
            tags=tags,
        )

        log_params = {
            **(extra or {}),
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        if self.integration_type:
            log_params[self.integration_type] = self.name

        # Capture useful response headers for debugging
        if resp is not None and resp.headers:
            if github_request_id := resp.headers.get("X-GitHub-Request-Id"):
                log_params["github_request_id"] = github_request_id
            if rate_limit_remaining := resp.headers.get("X-RateLimit-Remaining"):
                log_params["rate_limit_remaining"] = rate_limit_remaining
            if retry_after := resp.headers.get("Retry-After"):
                log_params["retry_after"] = retry_after

        log_params.update(getattr(self, "logging_context", None) or {})
        log_level = self.logger.warning if error else self.logger.info
        log_level("%s.http_response", self.integration_type, extra=log_params)

    def get_cache_prefix(self) -> str:
        return f"{self.integration_type}.{self.name}.client:"

    def build_url(self, path: str) -> str:
        if path.startswith("/"):
            if not self.base_url:
                raise ValueError(f"Invalid URL: {path}")
            base_url = self.base_url.rstrip("/")
            path = path.lstrip("/")
            return f"{base_url}/{path}"
        return path

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Allows subclasses to add hooks before sending requests out
        """
        return prepared_request

    def is_response_fatal(self, resp: Response) -> bool:
        return False

    def is_response_error(self, resp: Response) -> bool:
        if resp.status_code:
            if resp.status_code >= 400 and resp.status_code != 429 and resp.status_code < 500:
                return True
        return False

    def is_response_success(self, resp: Response) -> bool:
        if resp.status_code:
            if resp.status_code < 300:
                return True
        return False

    def is_error_fatal(self, error: Exception) -> bool:
        return False

    def build_session(self) -> SafeSession:
        """
        Generates a safe Requests session for the API client to use.
        """
        return build_session()

    @staticmethod
    def _normalize_cert_setting(cert_setting: object) -> str | tuple[str, str] | None:
        # ``requests`` accepts cert as None, a single cert path, or a
        # (cert_file, key_file) tuple.
        if cert_setting is None or isinstance(cert_setting, str):
            return cert_setting
        if (
            isinstance(cert_setting, tuple)
            and len(cert_setting) == 2
            and all(isinstance(item, str) for item in cert_setting)
        ):
            return cert_setting
        return None

    # Keep this helper as a typed boundary between requests'
    # ``merge_environment_settings`` output and ``session.send`` kwargs. This
    # prevents forwarding unexpected keys while keeping _request readable.
    def _build_session_settings(
        self,
        timeout: int,
        allow_redirects: bool,
        *,
        proxies: object | None = None,
        stream: object | None = None,
        verify: object | None = None,
        cert: object | None = None,
    ) -> SessionSettings:
        # Build a typed subset of session.send kwargs.
        session_settings: SessionSettings = {
            "timeout": timeout,
            "allow_redirects": allow_redirects,
        }

        if isinstance(proxies, MutableMapping):
            session_settings["proxies"] = proxies

        if isinstance(stream, bool) or stream is None:
            session_settings["stream"] = stream

        if isinstance(verify, bool) or isinstance(verify, str) or verify is None:
            session_settings["verify"] = verify

        session_settings["cert"] = self._normalize_cert_setting(cert)

        return session_settings

    @overload
    def _request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
        auth: tuple[str, str] | None = None,
        json: bool = True,
        allow_text: bool = False,
        allow_redirects: bool | None = None,
        timeout: int | None = None,
        ignore_webhook_errors: bool = False,
        prepared_request: PreparedRequest | None = None,
        stream: bool | None = None,
        raw_response: Literal[True] = ...,
        api_request_type: str | None = None,
    ) -> Response: ...

    @overload
    def _request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
        auth: str | None = None,
        json: bool = True,
        allow_text: bool = False,
        allow_redirects: bool | None = None,
        timeout: int | None = None,
        ignore_webhook_errors: bool = False,
        prepared_request: PreparedRequest | None = None,
        stream: bool | None = None,
        raw_response: bool = ...,
        api_request_type: str | None = None,
    ) -> Any: ...

    def _request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
        auth: tuple[str, str] | str | None = None,
        json: bool = True,
        allow_text: bool = False,
        allow_redirects: bool | None = None,
        timeout: int | None = None,
        ignore_webhook_errors: bool = False,
        prepared_request: PreparedRequest | None = None,
        stream: bool | None = None,
        raw_response: bool = False,
        api_request_type: str | None = None,
    ) -> Any | Response:
        if allow_redirects is None:
            allow_redirects = self.allow_redirects

        if allow_redirects is None:  # is still None
            allow_redirects = method.upper() == "GET"

        if timeout is None:
            timeout = self.timeout

        full_url = self.build_url(path)

        api_request_type_tag = str(api_request_type) if api_request_type is not None else None

        request_tags: dict[str, str] = {self.integration_type: self.name}
        if api_request_type_tag is not None:
            request_tags["api_request_type"] = api_request_type_tag
        metrics.incr(
            f"{self.metrics_prefix}.http_request",
            sample_rate=1.0,
            tags=request_tags,
        )

        if self.integration_type:
            sentry_sdk.get_isolation_scope().set_tag(self.integration_type, self.name)

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

        extra = {"url": full_url}
        # It shouldn't be possible for integration_type to be null.
        if self.integration_type:
            extra[self.integration_type] = self.name
        integration_id = getattr(self, "integration_id", None)
        if integration_id is not None:
            extra["integration_id"] = str(integration_id)
        if api_request_type_tag is not None:
            extra["api_request_type"] = api_request_type_tag

        try:
            with self.build_session() as session:
                finalized_request = self.finalize_request(_prepared_request)
                environment_settings = session.merge_environment_settings(
                    url=finalized_request.url,
                    proxies={},
                    stream=stream,
                    verify=self.verify_ssl,
                    cert=None,
                )
                session_settings = self._build_session_settings(
                    timeout=timeout,
                    allow_redirects=allow_redirects,
                    proxies=environment_settings.get("proxies"),
                    stream=environment_settings.get("stream"),
                    verify=environment_settings.get("verify"),
                    cert=environment_settings.get("cert"),
                )
                resp: Response = session.send(finalized_request, **session_settings)
                if raw_response:
                    return resp
                resp.raise_for_status()
        except RestrictedIPAddress as e:
            self.track_response_data("restricted_ip_address", e, extra=extra)
            raise ApiHostError.from_exception(e) from e
        except ConnectionError as e:
            self.track_response_data("connection_error", e, extra=extra)
            raise ApiHostError.from_exception(e) from e
        except Timeout as e:
            self.track_response_data("timeout", e, extra=extra)
            raise ApiTimeoutError.from_exception(e) from e
        except RetryError as e:
            self.track_response_data("max_retries", e, extra=extra)
            raise ApiRetryError.from_exception(e) from e
        except HTTPError as e:
            error_resp = e.response
            if error_resp is None:
                self.track_response_data("unknown", e, extra=extra)

                self.logger.exception("request.error", extra=extra)
                raise ApiError("Internal Error", url=full_url) from e

            self.track_response_data(error_resp.status_code, e, resp=error_resp, extra=extra)
            raise ApiError.from_response(error_resp, url=full_url) from e

        except Exception as e:
            # Sometimes a ConnectionResetError shows up two or three deep in an exception
            # chain, and you end up with an exception like
            #     `ChunkedEncodingError("Connection broken: ConnectionResetError(104, 'Connection reset by peer')",
            #          ConnectionResetError(104, 'Connection reset by peer'))`,
            # which is a ChunkedEncodingError caused by a ProtocolError caused by a ConnectionResetError.
            # Rather than worrying about what the other layers might be, we just stringify to detect this.
            if "ConnectionResetError" in str(e):
                self.track_response_data("connection_reset_error", e, extra=extra)
                raise ApiConnectionResetError("Connection reset by peer", url=full_url) from e
            # The same thing can happen with an InvalidChunkLength exception, which is a subclass of HTTPError
            if "InvalidChunkLength" in str(e):
                self.track_response_data("invalid_chunk_length", e, extra=extra)
                raise ApiError("Connection broken: invalid chunk length", url=full_url) from e

            # If it's not something we recognize, let the caller deal with it
            raise

        self.track_response_data(resp.status_code, None, resp, extra=extra)

        if resp.status_code == 204:
            return {}

        # BaseApiResponse.from_response returns MappingApiResponse (subclass of dict)
        # or SequenceApiResponse (subclass of list), or TextApiResponse (has str .text)
        return BaseApiResponse.from_response(
            resp, allow_text=allow_text, ignore_webhook_errors=ignore_webhook_errors
        )

    # subclasses should override ``request``
    def request(self, *args: Any, **kwargs: Any) -> Any:
        return self._request(*args, **kwargs)

    def delete(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("DELETE", path, *args, **kwargs)

    def get_cache_key(self, path: str, method: str, query: str = "", data: str | None = "") -> str:
        if not data:
            return (
                self.get_cache_prefix() + md5_text(self.build_url(path), method, query).hexdigest()
            )
        return (
            self.get_cache_prefix()
            + md5_text(self.build_url(path), method, query, data).hexdigest()
        )

    def check_cache(self, cache_key: str) -> Any | None:
        return cache.get(cache_key)

    def set_cache(self, cache_key: str, result: Any, cache_time: int) -> None:
        cache.set(cache_key, result, cache_time)

    def _get_cached(self, path: str, method: str, *args: Any, **kwargs: Any) -> Any:
        data = kwargs.get("data", None)
        query = ""
        if kwargs.get("params", None):
            query = json.dumps(kwargs.get("params"))

        key = self.get_cache_key(path, method, query, data)
        result = self.check_cache(key)
        api_request_type = kwargs.get("api_request_type")
        if api_request_type is None:
            api_request_type_tag = "unknown"
        else:
            api_request_type_tag = str(api_request_type)
        integration_tag_key = self.integration_type or "integration"
        metrics.incr(
            f"{self.metrics_prefix}.get_cached",
            sample_rate=1.0,
            tags={
                integration_tag_key: self.name,
                "api_request_type": str(api_request_type_tag),
                "result": "hit" if result is not None else "miss",
            },
        )
        if result is None:
            cache_time = kwargs.pop("cache_time", None) or self.cache_time
            result = self.request(method, path, *args, **kwargs)
            self.set_cache(key, result, cache_time)
        return result

    def get_cached(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self._get_cached(path, "GET", *args, **kwargs)

    def get(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("GET", path, *args, **kwargs)

    def patch(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("PATCH", path, *args, **kwargs)

    def post(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("POST", path, *args, **kwargs)

    def put(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("PUT", path, *args, **kwargs)

    def head(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self.request("HEAD", path, *args, **kwargs)

    def head_cached(self, path: str, *args: Any, **kwargs: Any) -> Any:
        return self._get_cached(path, "HEAD", *args, **kwargs)

    def get_with_pagination(
        self,
        path: str,
        gen_params: Callable[[int, int], Mapping[str, str | int | bool]],
        get_results: Callable[[Any], Sequence[_TPaginatedResult]],
        *args: Any,
        **kwargs: Any,
    ) -> list[_TPaginatedResult]:
        page_size = self.page_size
        output: list[_TPaginatedResult] = []

        for i in range(self.page_number_limit):
            resp = self.get(path, params=gen_params(i, page_size))
            results = get_results(resp)
            num_results = len(results)

            output += list(results)
            # if the number is lower than our page_size, we can quit
            if num_results < page_size:
                return output
        return output
