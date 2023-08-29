"""Scalar query filtering configuration module."""
from __future__ import annotations

from snuba_sdk import Column

# Scalar Sort Configuration.
scalar_sort_config: dict[str, Column] = {
    "browser.name": Column("browser_name"),
    "browser.version": Column("browser_version"),
    "device.brand": Column("device_brand"),
    "device.family": Column("device_family"),
    "device.model": Column("device_model"),
    "device.name": Column("device_name"),
    "dist": Column("dist"),
    "environment": Column("environment"),
    "os.name": Column("os_name"),
    "os.version": Column("os_version"),
    "platform": Column("platform"),
    "releases": Column("release"),
    "sdk.name": Column("sdk_name"),
    "sdk.version": Column("sdk_version"),
    "started_at": Column("replay_start_timestamp"),
    "user.email": Column("user_email"),
    "user.id": Column("user_id"),
    "user.ip_address": Column("ip_address_v4"),
    "user.username": Column("user_name"),
}


def can_scalar_sort_subquery(sort: str) -> bool:
    """Return "True" if we can apply the scalar sub-query optimization."""
    if sort.startswith("-"):
        sort = sort[1:]

    return sort in scalar_sort_config
