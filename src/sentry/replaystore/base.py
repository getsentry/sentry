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


class ReplayNotFound(ValueError):
    pass


class ReplayDataType(IntEnum):
    INIT = 1
    EVENT = 2
    PAYLOAD = 3

    @staticmethod
    def should_be_encoded() -> list[ReplayDataType]:
        return [ReplayDataType.INIT, ReplayDataType.EVENT]


@dataclass(frozen=True)
class ReplayContainer:
    id: str
    init: Dict[Any, Any]
    events: List[Dict[Any, Any]]
    payloads: List[Dict[Any, Any]]


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


class ReplayStore(abc.ABC, local, Service):
    KEY_DELIMETER = ":"

    __all__ = (
        "set",
        "get_replay",
    )

    def get_replay(self, replay_id: str) -> ReplayContainer | None:

        key = f"{replay_id}{self.KEY_DELIMETER}"

        try:
            init, events, payloads = self._get_all_events_for_replay(key)
        except ReplayNotFound:
            return None
        replay = ReplayContainer(replay_id, init, events, payloads)
        return replay

    def set(
        self, replay_init_id: str, data: Any, replay_data_type: ReplayDataType, timestamp: datetime
    ) -> None:
        key = self._row_key(replay_init_id, replay_data_type, timestamp.timestamp())

        if replay_data_type in ReplayDataType.should_be_encoded():
            # payloads dont need to be encoded as theyre already bytes (yum!)
            data = self._encode_event(data, replay_data_type)

        self._set_bytes(key, data)

    def _get_all_events_for_replay(
        self, key: str
    ) -> Tuple[Dict[Any, Any], List[Dict[Any, Any]], List[Dict[Any, Any]]]:
        data = self._get_rows(key)
        if len(data) == 0:
            raise ReplayNotFound

        events = []
        payloads = []
        init = {}
        for row in data:
            row_data = row[1]
            replay_data_type = self._get_row_type(row[0])

            if replay_data_type == ReplayDataType.INIT:
                init.update(self._decode(decompress(row_data)))
            if replay_data_type == ReplayDataType.EVENT:
                events.append(self._decode(decompress(row_data)))
            if replay_data_type == ReplayDataType.PAYLOAD:
                # don't parse json string of payload
                payloads.append(decompress(row_data))

        return init, events, payloads

    def _get_row_type(self, key: str) -> ReplayDataType:
        return ReplayDataType(int(key.split(self.KEY_DELIMETER)[1]))

    @abc.abstractmethod
    def _get_rows(self, key: Any) -> List[Tuple[str, bytes]]:
        pass

    def _encode_event(self, value: Any, replay_data_type: ReplayDataType) -> bytes:
        return cast(bytes, json_dumps(value).encode("utf8"))

    def _decode(self, value: bytes) -> Dict[Any, Any]:
        json_loaded: Dict[Any, Any] = json_loads(value)
        return json_loaded

    def _row_key(
        self, replay_init_id: str, replay_data_type: ReplayDataType, timestamp: float
    ) -> str:
        return (
            f"{replay_init_id}{self.KEY_DELIMETER}{replay_data_type}{self.KEY_DELIMETER}{timestamp}"
        )
