from __future__ import annotations

import logging
from typing import Any, Callable, FrozenSet, Mapping, MutableMapping, Optional, Sequence, Tuple

from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class UnexpectedOperation(Exception):
    pass


def basic_protocol_handler(
    unsupported_operations: FrozenSet[str],
) -> Callable[[str, Any, Any], Optional[dict[str, Any]]]:
    # The insert message formats for Version 1 and 2 are essentially unchanged,
    # so this function builds a handler function that can deal with both.

    def get_task_kwargs_for_insert(
        operation: str,
        event_data: Mapping[str, Any],
        task_state: Mapping[str, Any],
    ) -> Optional[dict[str, Any]]:
        if task_state and task_state.get("skip_consume", False):
            return None  # nothing to do

        kwargs = {
            "event_id": event_data["event_id"],
            "project_id": event_data["project_id"],
            "group_id": event_data["group_id"],
            "primary_hash": event_data["primary_hash"],
            "occurrence_id": event_data.get("occurrence_id"),
        }

        for name in ("is_new", "is_regression", "is_new_group_environment"):
            kwargs[name] = task_state[name]

        if task_state:
            kwargs["group_states"] = task_state.get("group_states")
            kwargs["queue"] = task_state.get("queue")

        return kwargs

    def handle_message(operation: str, *data: Any) -> Optional[dict[str, Any]]:
        if operation == "insert":
            return get_task_kwargs_for_insert(operation, *data)
        elif operation in unsupported_operations:
            logger.debug("Skipping unsupported operation: %s", operation)
            return None
        else:
            raise UnexpectedOperation(f"Received unexpected operation type: {operation!r}")

    return handle_message


version_handlers = {
    1: basic_protocol_handler(
        unsupported_operations=frozenset(["delete", "delete_groups", "merge", "unmerge"])
    ),
    2: basic_protocol_handler(
        unsupported_operations=frozenset(
            [
                "start_delete_groups",
                "end_delete_groups",
                "start_merge",
                "end_merge",
                "start_unmerge",
                "end_unmerge",
                "start_delete_tag",
                "end_delete_tag",
                "exclude_groups",
                "tombstone_events",
                "replace_group",
            ]
        )
    ),
}


class InvalidPayload(Exception):
    pass


class InvalidVersion(Exception):
    pass


def get_task_kwargs_for_message(value: bytes) -> Optional[dict[str, Any]]:
    """
    Decodes a message body, returning a dictionary of keyword arguments that
    can be applied to a post-processing task, or ``None`` if no task should be
    dispatched.
    """

    metrics.distribution("eventstream.events.size.data", len(value), unit="byte")
    payload = json.loads(value, use_rapid_json=True)

    try:
        version = payload[0]
    except Exception:
        raise InvalidPayload("Received event payload with unexpected structure")

    try:
        handler = version_handlers[int(version)]
    except (ValueError, KeyError):
        raise InvalidVersion(
            f"Received event payload with unexpected version identifier: {version}"
        )

    return handler(*payload[1:])


def decode_str(value: bytes) -> str:
    assert isinstance(value, bytes)
    return value.decode("utf-8")


def decode_optional_str(value: Optional[bytes]) -> Optional[str]:
    if value is None:
        return None
    return decode_str(value)


def decode_int(value: bytes) -> int:
    assert isinstance(value, bytes)
    return int(value)


def decode_optional_int(value: Optional[bytes]) -> Optional[int]:
    if value is None:
        return None
    return decode_int(value)


def decode_bool(value: bytes) -> bool:
    return bool(int(decode_str(value)))


def decode_optional_list_str(value: Optional[str]) -> Optional[Sequence[Any]]:
    if value is None:
        return None

    parsed = json.loads(value)
    if not isinstance(parsed, list):
        raise ValueError(f"'{value}' could not be parsed into an instance of list.")

    return json.loads(value)


def get_task_kwargs_for_message_from_headers(
    headers: Sequence[Tuple[str, Optional[bytes]]]
) -> Optional[dict[str, Any]]:
    """
    Same as get_task_kwargs_for_message but gets the required information from
    the kafka message headers.
    """
    try:
        header_data = {k: v for k, v in headers}

        def _required(k: str) -> bytes:
            v = header_data[k]
            if v is None:
                raise ValueError(f"expected {k!r} to be non-None")
            return v

        version = decode_int(_required("version"))
        operation = decode_str(_required("operation"))

        if operation == "insert":
            if "group_id" not in header_data:
                header_data["group_id"] = None
            if "primary_hash" not in header_data:
                header_data["primary_hash"] = None

            primary_hash = decode_optional_str(header_data["primary_hash"])
            event_id = decode_str(_required("event_id"))
            group_id = decode_optional_int(header_data["group_id"])
            project_id = decode_int(_required("project_id"))

            event_data = {
                "event_id": event_id,
                "group_id": group_id,
                "project_id": project_id,
                "primary_hash": primary_hash,
                "occurrence_id": decode_optional_str(header_data.get("occurrence_id")),
            }

            skip_consume = decode_bool(_required("skip_consume"))
            is_new = decode_bool(_required("is_new"))
            is_regression = decode_bool(_required("is_regression"))
            is_new_group_environment = decode_bool(_required("is_new_group_environment"))

            task_state: MutableMapping[str, Any] = {
                "skip_consume": skip_consume,
                "is_new": is_new,
                "is_regression": is_regression,
                "is_new_group_environment": is_new_group_environment,
            }

            group_states_str = decode_optional_str(header_data.get("group_states"))
            group_states = None
            try:
                group_states = decode_optional_list_str(group_states_str)
            except ValueError:
                logger.exception(
                    "Received event with malformed group_states: '%s'", group_states_str
                )
            except Exception:
                logger.exception(
                    "Uncaught exception thrown when trying to parse group_states: '%s'",
                    group_states_str,
                )
            task_state["group_states"] = group_states

            # default in case queue is not sent
            task_state["queue"] = (
                decode_str(_required("queue")) if "queue" in header_data else "post_process_errors"
            )

        else:
            event_data = {}
            task_state = {}

    except Exception:
        raise InvalidPayload("Received event payload with unexpected structure")

    try:
        handler = version_handlers[version]
    except (ValueError, KeyError):
        raise InvalidVersion(
            f"Received event payload with unexpected version identifier: {version}"
        )

    return handler(operation, event_data, task_state)
