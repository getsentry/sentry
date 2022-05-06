from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum
from threading import local
from typing import Any, Dict, List, Tuple, cast

from sentry.utils import json
from sentry.utils.services import Service
from sentry.utils.strings import decompress

json_dumps = json.JSONEncoder(
    separators=(",", ":"),
    sort_keys=True,
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding="utf-8",
    default=None,
).encode

json_loads = json._default_decoder.decode


class ReplayNotFound(ValueError):
    pass


class ReplayDataType(IntEnum):
    INIT = 1
    EVENT = 2
    PAYLOAD = 3

    @staticmethod
    def encoded_types() -> list[ReplayDataType]:
        return [ReplayDataType.INIT, ReplayDataType.EVENT]


ReplayEvent = Dict[str, Any]  # TODO: replace this with TypedDict once schema more ironed out


@dataclass(frozen=True)
class ReplayContainer:
    id: str
    init: ReplayEvent
    events: List[ReplayEvent]
    payloads: List[bytes]


class ReplayStore(abc.ABC, local, Service):
    KEY_DELIMETER = ":"

    __all__ = (
        "set_event",
        "set_payload",
        "get_replay",
    )

    def get_replay(self, replay_id: str) -> ReplayContainer | None:
        try:
            init, events, payloads = self._get_all_events_for_replay(replay_id)
        except ReplayNotFound:
            return None
        return ReplayContainer(replay_id, init, events, payloads)

    def set_event(
        self,
        replay_init_id: str,
        data: ReplayEvent,
        replay_data_type: ReplayDataType,
        timestamp: datetime,
    ) -> None:
        self._set_bytes(replay_init_id, replay_data_type, timestamp, self._encode_event(data))

    def set_payload(self, replay_init_id: str, data: bytes, timestamp: datetime) -> None:
        self._set_bytes(replay_init_id, ReplayDataType.PAYLOAD, timestamp, data)

    def _get_all_events_for_replay(
        self, replay_id: str
    ) -> Tuple[Dict[Any, Any], List[Dict[Any, Any]], List[bytes]]:
        replay_data = self._get_rows(replay_id)
        if len(replay_data) == 0:
            raise ReplayNotFound

        events = []
        payloads = []
        init = {}
        for (replay_data_type, row_data) in replay_data:
            if replay_data_type == ReplayDataType.INIT:
                init.update(self._decode(decompress(row_data)))
            if replay_data_type == ReplayDataType.EVENT:
                events.append(self._decode(decompress(row_data)))
            if replay_data_type == ReplayDataType.PAYLOAD:
                # don't parse json string of payload
                payloads.append(decompress(row_data))

        return init, events, payloads

    @abc.abstractmethod
    def _get_rows(self, replay_id: str) -> List[Tuple[ReplayDataType, bytes]]:
        pass

    def _encode_event(self, value: ReplayEvent) -> bytes:
        return cast(bytes, json_dumps(value).encode("utf8"))

    def _decode(self, value: bytes) -> Dict[Any, Any]:
        json_loaded: Dict[Any, Any] = json_loads(value)
        return json_loaded

    @abc.abstractmethod
    def _set_bytes(
        self,
        replay_init_id: str,
        replay_data_type: ReplayDataType,
        timestamp: datetime,
        data: bytes,
    ) -> None:
        pass
