import logging
import time
from abc import ABC, abstractmethod
from collections import deque
from concurrent.futures import Future
from typing import Any, Deque, MutableMapping, NamedTuple, Optional, Tuple

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import Commit, Message, Partition, Position, Topic
from confluent_kafka import Producer

logger = logging.getLogger(__name__)


class RoutingPayload(NamedTuple):
    """
    Payload suitable for the ``RoutingProducer``. ``MessageRouter`` works
    with this payload type. The routing_headers are used to determine the
    route for the message. The payload is the message body which should be sent
    to the destination topic.
    """

    routing_header: MutableMapping[str, Any]
    routing_message: KafkaPayload


class MessageRoute(NamedTuple):
    """
    A MessageRoute is a tuple of (producer, topic) that a message should be
    routed to.
    """

    producer: Producer
    topic: Topic


class MessageRouter(ABC):
    """
    An abstract class that defines the interface for a message router. A message
    router relies on the implementation of the get_route_for_message method
    to perform the actual routing.

    Some examples of what message routers could do include:
    1. A message router that routes messages to a single topic. This is
    similar to not having a message router at all.
    2. A message router that performs round robin routing to a set of topics.
    3. A message router that routes messages to a topic based on which slice
    the message needs to be sent to.
    """

    @abstractmethod
    def get_route_for_message(self, message: Message[RoutingPayload]) -> MessageRoute:
        """
        This method must return the MessageRoute on which the message should
        be produced. Implementations of this method can vary based on the
        specific use case.
        """
        raise NotImplementedError

    @abstractmethod
    def shutdown(self) -> None:
        """
        Shutdown the router. This method can be used to perform any cleanup
        needed by the router.
        """
        raise NotImplementedError


class RoutingProducerStep(ProcessingStrategy[RoutingPayload]):
    """
    This strategy is used to route messages to different producers/topics
    based on the message payload. It delegates the routing logic to the
    message router class which is passed in as a parameter. Please look at
    the documentation for the MessageRouter class for more details.

    The strategy also does not own any producers. The producers are owned by
    the message router.
    """

    def __init__(
        self,
        commit_function: Commit,
        message_router: MessageRouter,
    ) -> None:
        self.__commit_function = commit_function
        self.__message_router = message_router
        self.__closed = False
        self.__offsets_to_be_committed: MutableMapping[Partition, Position] = {}
        self.__queue: Deque[Tuple[Partition, Position, Future[Message[KafkaPayload]]]] = deque()

    def poll(self) -> None:
        """
        Periodically check which messages have been produced successfully and
        call the commit function for the offsets that have been processed.
        In order to commit offsets we need strict ordering, hence we stop
        processing the queue of pending futures as soon as we encounter one
        which is not yet completed.
        """
        while self.__queue:
            partition, position, future = self.__queue[0]

            if not future.done():
                break

            future.result()

            self.__queue.popleft()
            self.__commit_function({partition: position})

    def submit(self, message: Message[RoutingPayload]) -> None:
        """
        This is where the actual routing happens. Each message is passed to the
        message router to get the producer and topic to which the message should
        be sent. The message is then sent to the producer and the future is
        stored in the queue.
        """
        assert not self.__closed
        producer, topic = self.__message_router.get_route_for_message(message)
        output_message = Message(
            partition=message.partition,
            offset=message.offset,
            timestamp=message.timestamp,
            payload=message.payload.routing_message.value,
        )

        self.__queue.append(
            (
                output_message.partition,
                output_message.position_to_commit,
                producer.produce(destination=topic, payload=output_message.payload),
            )
        )

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        """
        In addition to flushing the queue, this method also calls the
        shutdown of the router.
        """
        start = time.time()

        # Commit all previously staged offsets
        self.__commit_function({}, force=True)

        while self.__queue:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__queue)} futures in queue")
                break

            partition, position, future = self.__queue.popleft()
            future.result(remaining)
            offset = {partition: position}

            logger.info("Committing offset: %r", offset)
            self.__commit_function(offset, force=True)
