"""Scalar query filtering configuration module."""
from typing import Union

from sentry.replays.lib.new_query.conditions import (
    IPv4Scalar,
    StringArray,
    StringScalar,
    UUIDScalar,
)
from sentry.replays.lib.new_query.fields import ColumnField, StringColumnField, UUIDColumnField
from sentry.replays.lib.new_query.parsers import parse_str, parse_uuid
from sentry.replays.lib.selector.parse import parse_selector
from sentry.replays.usecases.query.conditions import ClickSelectorComposite, ErrorIdsArray
from sentry.replays.usecases.query.fields import ComputedField

# Event Search Config
event_search_config: dict[str, Union[ColumnField, ComputedField]] = {
    "browser.name": StringColumnField("browser_name", parse_str, StringScalar),
    "browser.version": StringColumnField("browser_version", parse_str, StringScalar),
    "device.brand": StringColumnField("device_brand", parse_str, StringScalar),
    "device.family": StringColumnField("device_family", parse_str, StringScalar),
    "device.model": StringColumnField("device_model", parse_str, StringScalar),
    "device.name": StringColumnField("device_name", parse_str, StringScalar),
    "dist": StringColumnField("dist", parse_str, StringScalar),
    "environment": StringColumnField("environment", parse_str, StringScalar),
    "error_ids": ComputedField(parse_uuid, ErrorIdsArray),
    "id": StringColumnField("replay_id", lambda x: str(parse_uuid(x)), StringScalar),
    "os.name": StringColumnField("os_name", parse_str, StringScalar),
    "os.version": StringColumnField("os_version", parse_str, StringScalar),
    "platform": StringColumnField("platform", parse_str, StringScalar),
    "releases": StringColumnField("release", parse_str, StringScalar),
    "sdk.name": StringColumnField("sdk_name", parse_str, StringScalar),
    "sdk.version": StringColumnField("sdk_version", parse_str, StringScalar),
    "trace_ids": UUIDColumnField("trace_ids", parse_uuid, UUIDScalar),
    "urls": StringColumnField("urls", parse_str, StringArray),
    "user.email": StringColumnField("user_email", parse_str, StringScalar),
    "user.id": StringColumnField("user_id", parse_str, StringScalar),
    "user.ip_address": StringColumnField("ip_address_v4", parse_str, IPv4Scalar),
    "user.username": StringColumnField("user_name", parse_str, StringScalar),
}


# Click Search Config
#
# Clicks are separated from events because events and clicks are two separate "row types" which
# can never overlap.  In other words asking a scalar query that asks for an event value AND/OR a
# click value can never yield correct results because they can never share the same row. The
# separation is done so validation checks can be more easily enforced.
click_search_config: dict[str, Union[ColumnField, ComputedField]] = {
    "click.alt": StringColumnField("click_alt", parse_str, StringScalar),
    "click.class": StringColumnField("click_class", parse_str, StringArray),
    "click.id": StringColumnField("click_id", parse_str, StringScalar),
    "click.label": StringColumnField("click_aria_label", parse_str, StringScalar),
    "click.role": StringColumnField("click_role", parse_str, StringScalar),
    "click.selector": ComputedField(parse_selector, ClickSelectorComposite),
    "click.tag": StringColumnField("click_tag", parse_str, StringScalar),
    "click.testid": StringColumnField("click_testid", parse_str, StringScalar),
    "click.textContent": StringColumnField("click_text", parse_str, StringScalar),
    "click.title": StringColumnField("click_title", parse_str, StringScalar),
}
