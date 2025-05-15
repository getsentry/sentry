from functools import partial

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP, SPANDATA
from sentry_sdk_alpha.integrations import _check_minimum_version, Integration, DidNotEnable
from sentry_sdk_alpha.utils import (
    capture_internal_exceptions,
    ensure_integration_enabled,
    parse_url,
    parse_version,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from typing import Dict
    from typing import Optional
    from typing import Type

    from sentry_sdk_alpha.tracing import Span

try:
    from botocore import __version__ as BOTOCORE_VERSION  # type: ignore
    from botocore.client import BaseClient  # type: ignore
    from botocore.response import StreamingBody  # type: ignore
    from botocore.awsrequest import AWSRequest  # type: ignore
except ImportError:
    raise DidNotEnable("botocore is not installed")


class Boto3Integration(Integration):
    identifier = "boto3"
    origin = f"auto.http.{identifier}"

    @staticmethod
    def setup_once():
        # type: () -> None
        version = parse_version(BOTOCORE_VERSION)
        _check_minimum_version(Boto3Integration, version, "botocore")

        orig_init = BaseClient.__init__

        def sentry_patched_init(self, *args, **kwargs):
            # type: (Type[BaseClient], *Any, **Any) -> None
            orig_init(self, *args, **kwargs)
            meta = self.meta
            service_id = meta.service_model.service_id.hyphenize()
            meta.events.register(
                "request-created",
                partial(_sentry_request_created, service_id=service_id),
            )
            meta.events.register("after-call", _sentry_after_call)
            meta.events.register("after-call-error", _sentry_after_call_error)

        BaseClient.__init__ = sentry_patched_init


@ensure_integration_enabled(Boto3Integration)
def _sentry_request_created(service_id, request, operation_name, **kwargs):
    # type: (str, AWSRequest, str, **Any) -> None
    description = "aws.%s.%s" % (service_id, operation_name)
    span = sentry_sdk_alpha.start_span(
        op=OP.HTTP_CLIENT,
        name=description,
        origin=Boto3Integration.origin,
        only_if_parent=True,
    )

    data = {
        SPANDATA.HTTP_METHOD: request.method,
    }
    with capture_internal_exceptions():
        parsed_url = parse_url(request.url, sanitize=False)
        data["aws.request.url"] = parsed_url.url
        data[SPANDATA.HTTP_QUERY] = parsed_url.query
        data[SPANDATA.HTTP_FRAGMENT] = parsed_url.fragment

    for key, value in data.items():
        span.set_attribute(key, value)

    span.set_tag("aws.service_id", service_id)
    span.set_tag("aws.operation_name", operation_name)

    # We do it in order for subsequent http calls/retries be
    # attached to this span.
    span.__enter__()

    # request.context is an open-ended data-structure
    # where we can add anything useful in request life cycle.
    request.context["_sentrysdk_span"] = span
    request.context["_sentrysdk_span_data"] = data


def _sentry_after_call(context, parsed, **kwargs):
    # type: (Dict[str, Any], Dict[str, Any], **Any) -> None
    span = context.pop("_sentrysdk_span", None)  # type: Optional[Span]

    # Span could be absent if the integration is disabled.
    if span is None:
        return

    span_data = context.pop("_sentrysdk_span_data", {})

    sentry_sdk_alpha.add_breadcrumb(
        type="http",
        category="httplib",
        data=span_data,
    )

    body = parsed.get("Body")
    if not isinstance(body, StreamingBody):
        span.__exit__(None, None, None)
        return

    streaming_span = sentry_sdk_alpha.start_span(
        op=OP.HTTP_CLIENT_STREAM,
        name=span.name,
        origin=Boto3Integration.origin,
        only_if_parent=True,
    )

    orig_read = body.read

    def sentry_streaming_body_read(*args, **kwargs):
        # type: (*Any, **Any) -> bytes
        try:
            ret = orig_read(*args, **kwargs)
            if not ret:
                streaming_span.finish()
            return ret
        except Exception:
            streaming_span.finish()
            raise

    body.read = sentry_streaming_body_read

    orig_close = body.close

    def sentry_streaming_body_close(*args, **kwargs):
        # type: (*Any, **Any) -> None
        streaming_span.finish()
        orig_close(*args, **kwargs)

    body.close = sentry_streaming_body_close

    span.__exit__(None, None, None)


def _sentry_after_call_error(context, exception, **kwargs):
    # type: (Dict[str, Any], Type[BaseException], **Any) -> None
    span = context.pop("_sentrysdk_span", None)  # type: Optional[Span]

    # Span could be absent if the integration is disabled.
    if span is None:
        return

    span_data = context.pop("_sentrysdk_span_data", {})

    sentry_sdk_alpha.add_breadcrumb(
        type="http",
        category="httplib",
        data=span_data,
    )

    span.__exit__(type(exception), exception, None)
