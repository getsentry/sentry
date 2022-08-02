from typing import Any, Literal, Mapping, Optional, Tuple, Union

import urllib3

from sentry.eventstream.abstract import EventStreamBackend
from sentry.eventstream.base import ForwarderNotRequired
from sentry.eventstream.utils import EVENT_PROTOCOL_VERSION
from sentry.utils import json, snuba


class SnubaEventStreamBackend(EventStreamBackend):
    def __init__(self, dataset: str):
        self.dataset = dataset

    def send(
        self,
        project_id: int,
        _type: str,
        extra_data: Tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: Optional[Mapping[str, str]] = None,
    ):
        if headers is None:
            headers = {}

        data = (EVENT_PROTOCOL_VERSION, _type) + extra_data

        try:
            resp = snuba._snuba_pool.urlopen(
                "POST",
                f"/tests/{self.dataset}/eventstream",
                body=json.dumps(data),
                headers={f"X-Sentry-{k}": v for k, v in headers.items()},
            )
            if resp.status != 200:
                raise snuba.SnubaError("HTTP %s response from Snuba!" % resp.status)
            return resp
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)

    def requires_post_process_forwarder(self) -> bool:
        return False

    def run_forwarder(
        self,
        consumer_group: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
    ):
        raise ForwarderNotRequired
