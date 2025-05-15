"""
Code used for the Queries module in Sentry
"""

from sentry_sdk_alpha.consts import OP, SPANDATA
from sentry_sdk_alpha.integrations.redis.utils import _get_safe_command
from sentry_sdk_alpha.utils import capture_internal_exceptions

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from redis import Redis
    from sentry_sdk_alpha.integrations.redis import RedisIntegration
    from typing import Any


def _compile_db_span_properties(integration, redis_command, args):
    # type: (RedisIntegration, str, tuple[Any, ...]) -> dict[str, Any]
    description = _get_db_span_description(integration, redis_command, args)

    properties = {
        "op": OP.DB_REDIS,
        "description": description,
    }

    return properties


def _get_db_span_description(integration, command_name, args):
    # type: (RedisIntegration, str, tuple[Any, ...]) -> str
    description = command_name

    with capture_internal_exceptions():
        description = _get_safe_command(command_name, args)

    data_should_be_truncated = (
        integration.max_data_size and len(description) > integration.max_data_size
    )
    if data_should_be_truncated:
        description = description[: integration.max_data_size - len("...")] + "..."

    return description


def _get_connection_data(connection_params):
    # type: (dict[str, Any]) -> dict[str, Any]
    data = {
        SPANDATA.DB_SYSTEM: "redis",
    }

    db = connection_params.get("db")
    if db is not None:
        data[SPANDATA.DB_NAME] = str(db)

    host = connection_params.get("host")
    if host is not None:
        data[SPANDATA.SERVER_ADDRESS] = host

    port = connection_params.get("port")
    if port is not None:
        data[SPANDATA.SERVER_PORT] = port

    return data


def _get_db_data(redis_instance):
    # type: (Redis[Any]) -> dict[str, Any]
    try:
        return _get_connection_data(redis_instance.connection_pool.connection_kwargs)
    except AttributeError:
        return {}  # connections_kwargs may be missing in some cases
