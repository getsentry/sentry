from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Deque, Generic, TypeVar

from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Partition, TStrategyPayload

from sentry.utils.arroyo_guard import NonFinalStrategy, guard

TResult = TypeVar("TResult")


class MergeRoutes(ProcessingStrategy[TResult], Generic[TResult]):
    def __init__(self, routing_key: str, buffer: MessageBuffer[TResult]) -> None:
        self.routing_key = routing_key
        self.buffer = buffer

    def submit(self, message: Message[TResult]) -> None:
        self.buffer.add(message, self.routing_key)

    def poll(self) -> None:
        pass

    def join(self, timeout: float | None = None) -> None:
        pass

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass


@guard
class Router(
    NonFinalStrategy[TStrategyPayload, TResult],
):
    def __init__(
        self,
        next_step: ProcessingStrategy[TResult],
        route_builders: Mapping[
            str, Callable[[MergeRoutes[TResult]], ProcessingStrategy[TStrategyPayload]]
        ],
        routing_func: Callable[[Message[TStrategyPayload]], str],
    ) -> None:
        self.buffer: MessageBuffer[TResult] = MessageBuffer(list(route_builders.keys()))
        self.routing_func = routing_func
        self.next_step = next_step

        self.routes: Mapping[str, ProcessingStrategy[TStrategyPayload]] = {
            routing_key: builder(MergeRoutes(routing_key, self.buffer))
            for (routing_key, builder) in route_builders.items()
        }

    def submit(self, message: Message[TStrategyPayload]) -> None:
        if len(self.buffer) > 10000:
            raise MessageRejected

        message_route = self.routing_func(message)
        self.routes[message_route].submit(message)

        while True:
            next_message = self.buffer.poll()
            if next_message:
                self.next_step.submit(next_message)  # this is fine because of guard
            else:
                break

    def poll(self) -> None:
        for route in self.routes.values():
            route.poll()

        self.next_step.poll()

    def join(self, timeout: float | None = None) -> None:
        deadline = time.time() + timeout if timeout else None
        for route in self.routes.values():
            remaining = deadline - time.time() if deadline else None
            route.join(remaining)

        remaining = deadline - time.time() if deadline else None
        self.next_step.join(remaining)

    def close(self) -> None:
        for route in self.routes.values():
            route.close()
        self.next_step.close()

    def terminate(self) -> None:
        for route in self.routes.values():
            route.terminate()
        self.next_step.terminate()


class MessageBuffer(Generic[TResult]):
    """
    Keeps track of the in-flight offsets for all routes, and buffers messages for
    submission to the next step so that messages to subsequent stages are submitted only
    after it's committable offset is reached on all routes.
    """

    def __init__(self, routes: Sequence[str]) -> None:
        # Maintains the last committable offsets for each route and partition
        self.committable_offsets: Mapping[str, MutableMapping[Partition, int]] = {
            r: {} for r in routes
        }

        # the low watermarks?
        self.committable_offsets: Mapping[str, MutableMapping[Partition, int]] = {
            r: {} for r in routes
        }

        # Keeps track of all completed messages together with the route on which it was sent
        self.messages: Deque[tuple[str, Message[TResult]]] = deque()

    def add(self, message: Message[TResult], routing_key: str) -> None:
        self.messages.append((routing_key, message))

        for partition, committable_offset in message.committable.items():
            if self.committable_offsets[routing_key].get(partition):
                if committable_offset > self.committable_offsets[routing_key][partition]:
                    self.committable_offsets[routing_key][partition] = committable_offset
            else:
                self.committable_offsets[routing_key][partition] = committable_offset

    def poll(self) -> Message[TResult] | None:
        if not self.messages:
            return None

        (route, message) = self.messages[0]

        # Ensure the message isn't returned if it's not completed yet
        for partition, committable_offset in message.committable.items():
            partition_offset = self.committable_offsets[route].get(partition)

            if partition_offset is None or committable_offset > partition_offset:
                return None

        self.messages.popleft()
        return message

    def __len__(self) -> int:
        return len(self.messages)
