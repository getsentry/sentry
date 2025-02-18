import dataclasses
import time

from sentry.replays.consumers.buffered.lib import Model, buffering_runtime


class Flusher:

    def __init__(self, flags: dict[str, str]) -> None:
        self.max_buffer_length = int(flags["max_buffer_length"])
        self.max_buffer_wait = int(flags["max_buffer_wait"])
        self.__last_flushed_at = time.time()

    def can_flush(self) -> bool:
        return (time.time() - self.max_buffer_wait) >= self.__last_flushed_at

    def do_flush(self) -> None:
        self.__last_flushed_at = time.time()
        # TODO: upload the bytes or something.


@dataclasses.dataclass
class Item:
    recording: bytes


def init(flags: dict[str, str]) -> Model[Item]:
    flusher = Flusher(flags)
    return Model(
        buffer=[],
        can_flush=flusher.can_flush,
        do_flush=flusher.do_flush,
        offsets={},
        retries=0,
    )


def process_message(message: bytes) -> Item:
    return Item(recording=message)


recording_consumer = buffering_runtime(
    init_fn=init,
    process_fn=process_message,
)
