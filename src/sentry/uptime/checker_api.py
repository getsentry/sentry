import uuid
from collections.abc import Sequence
from typing import NotRequired, TypedDict

import requests

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.models import UptimeRegionScheduleMode
from sentry.uptime.types import CheckConfig, RequestHeader, RequestMethod


class _PreviewCheckData(TypedDict):
    url: str
    timeout_ms: int | float
    method: NotRequired[RequestMethod]
    headers: NotRequired[Sequence[RequestHeader]]
    body: NotRequired[str]
    assertion: NotRequired[object]


# Create a "preview check" that we send to an uptime checker to validate the config
# (in particular, the assertion.)
def create_preview_check(
    validated_data: _PreviewCheckData, region: UptimeRegionConfig
) -> CheckConfig:
    config: CheckConfig = {
        "subscription_id": uuid.UUID(int=0).hex,
        "url": validated_data.get("url"),
        "interval_seconds": 3600,
        "timeout_ms": validated_data.get("timeout_ms"),
        "trace_sampling": False,
        # We're only going to run in the one specified region.
        "active_regions": [region.slug],
        "region_schedule_mode": UptimeRegionScheduleMode.ROUND_ROBIN.value,
    }

    method = validated_data.get("method")
    if method is not None:
        config["request_method"] = method

    headers = validated_data.get("headers")
    if headers is not None:
        config["request_headers"] = headers

    body = validated_data.get("body")
    if body is not None:
        config["request_body"] = body

    assertion = validated_data.get("assertion")
    if assertion is not None:
        config["assertion"] = assertion

    return config


# Call into the uptime checker to validation the check config, throwing a validation
# error if the config does not pass validation.
def invoke_checker_validator(
    check_config: CheckConfig, region: UptimeRegionConfig
) -> requests.Response | None:
    if not region.api_endpoint:
        return None

    result = requests.post(
        f"http://{region.api_endpoint}/validate_check",
        json=check_config,
        timeout=10,
    )

    return result


# Call into the uptime checker to execute the check config
def invoke_checker_preview(
    check_config: CheckConfig, region: UptimeRegionConfig
) -> requests.Response | None:
    if not region.api_endpoint:
        return None

    result = requests.post(
        f"http://{region.api_endpoint}/execute_config",
        json=check_config,
        timeout=10,
    )

    return result
