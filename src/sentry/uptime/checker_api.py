import uuid

import requests
from rest_framework import serializers

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.models import UptimeRegionScheduleMode
from sentry.uptime.types import CheckConfig


# Create a "preview check" that we send to an uptime checker to validate the config
# (in particular, the assertion.)
def create_check(validated_data, region: UptimeRegionConfig):
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

    config["request_method"] = validated_data.get("method")
    config["request_headers"] = validated_data.get("headers")
    config["request_body"] = validated_data.get("body")
    config["assertion"] = validated_data.get("assertion")

    return config


# Call into the uptime checker to validation the check config, throwing a validation
# error if the config does not pass validation.
def invoke_checker_validator(
    validation_enabled: bool, check_config: CheckConfig, api_endpoint: str
):
    if not validation_enabled:
        return

    # If we are unable to reach the validation server, we just let the exception get raised
    # and propagate.
    result = requests.post(
        f"http://{api_endpoint}/validate_check",
        json=check_config,
        timeout=10,
    )
    if result.status_code >= 400:
        raise serializers.ValidationError({"assertion": result.json()})
