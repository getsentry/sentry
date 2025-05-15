import sentry_sdk_alpha
from sentry_sdk_alpha.consts import SPANDATA
from sentry_sdk_alpha.integrations.redis.consts import (
    _COMMANDS_INCLUDING_SENSITIVE_DATA,
    _MAX_NUM_ARGS,
    _MAX_NUM_COMMANDS,
    _MULTI_KEY_COMMANDS,
    _SINGLE_KEY_COMMANDS,
)
from sentry_sdk_alpha.scope import should_send_default_pii
from sentry_sdk_alpha.utils import SENSITIVE_DATA_SUBSTITUTE

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any, Optional, Sequence
    from sentry_sdk_alpha.tracing import Span


TAG_KEYS = [
    "redis.command",
    "redis.is_cluster",
    "redis.key",
    "redis.transaction",
    SPANDATA.DB_OPERATION,
]


def _update_span(span, *data_bags):
    # type: (Span, *dict[str, Any]) -> None
    """
    Set tags and data on the given span to data from the given data bags.
    """
    for data in data_bags:
        for key, value in data.items():
            if key in TAG_KEYS:
                span.set_tag(key, value)
            else:
                span.set_attribute(key, value)


def _create_breadcrumb(message, *data_bags):
    # type: (str, *dict[str, Any]) -> None
    """
    Create a breadcrumb containing the tags data from the given data bags.
    """
    data = {}
    for data in data_bags:
        for key, value in data.items():
            if key in TAG_KEYS:
                data[key] = value

    sentry_sdk_alpha.add_breadcrumb(
        message=message,
        type="redis",
        category="redis",
        data=data,
    )


def _get_safe_command(name, args):
    # type: (str, Sequence[Any]) -> str
    command_parts = [name]

    for i, arg in enumerate(args):
        if i > _MAX_NUM_ARGS:
            break

        name_low = name.lower()

        if name_low in _COMMANDS_INCLUDING_SENSITIVE_DATA:
            command_parts.append(SENSITIVE_DATA_SUBSTITUTE)
            continue

        arg_is_the_key = i == 0
        if arg_is_the_key:
            command_parts.append(repr(arg))

        else:
            if should_send_default_pii():
                command_parts.append(repr(arg))
            else:
                command_parts.append(SENSITIVE_DATA_SUBSTITUTE)

    command = " ".join(command_parts)
    return command


def _safe_decode(key):
    # type: (Any) -> str
    if isinstance(key, bytes):
        try:
            return key.decode()
        except UnicodeDecodeError:
            return ""

    return str(key)


def _key_as_string(key):
    # type: (Any) -> str
    if isinstance(key, (dict, list, tuple)):
        key = ", ".join(_safe_decode(x) for x in key)
    elif isinstance(key, bytes):
        key = _safe_decode(key)
    elif key is None:
        key = ""
    else:
        key = str(key)

    return key


def _get_safe_key(method_name, args, kwargs):
    # type: (str, Optional[tuple[Any, ...]], Optional[dict[str, Any]]) -> Optional[tuple[str, ...]]
    """
    Gets the key (or keys) from the given method_name.
    The method_name could be a redis command or a django caching command
    """
    key = None

    if args is not None and method_name.lower() in _MULTI_KEY_COMMANDS:
        # for example redis "mget"
        key = tuple(args)

    elif args is not None and len(args) >= 1:
        # for example django "set_many/get_many" or redis "get"
        if isinstance(args[0], (dict, list, tuple)):
            key = tuple(args[0])
        else:
            key = (args[0],)

    elif kwargs is not None and "key" in kwargs:
        # this is a legacy case for older versions of Django
        if isinstance(kwargs["key"], (list, tuple)):
            if len(kwargs["key"]) > 0:
                key = tuple(kwargs["key"])
        else:
            if kwargs["key"] is not None:
                key = (kwargs["key"],)

    return key


def _parse_rediscluster_command(command):
    # type: (Any) -> Sequence[Any]
    return command.args


def _get_pipeline_data(is_cluster, get_command_args_fn, is_transaction, command_stack):
    # type: (bool, Any, bool, Sequence[Any]) -> dict[str, Any]
    data = {
        "redis.is_cluster": is_cluster,
        "redis.transaction": is_transaction,
    }  # type: dict[str, Any]

    commands = []
    for i, arg in enumerate(command_stack):
        if i >= _MAX_NUM_COMMANDS:
            break

        command = get_command_args_fn(arg)
        commands.append(_get_safe_command(command[0], command[1:]))

    data["redis.commands.count"] = len(command_stack)
    data["redis.commands.first_ten"] = commands

    return data


def _get_client_data(is_cluster, name, *args):
    # type: (bool, str, *Any) -> dict[str, Any]
    data = {
        "redis.is_cluster": is_cluster,
    }  # type: dict[str, Any]

    if name:
        data["redis.command"] = name
        data[SPANDATA.DB_OPERATION] = name

    if name and args:
        name_low = name.lower()
        if (name_low in _SINGLE_KEY_COMMANDS) or (
            name_low in _MULTI_KEY_COMMANDS and len(args) == 1
        ):
            data["redis.key"] = args[0]

    return data
