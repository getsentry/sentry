from __future__ import annotations

from typing import Protocol, TypedDict
from urllib.parse import urlparse

import kombu
from amqp import Channel, Connection
from django.conf import settings
from django.utils.functional import cached_property
from redis import StrictRedis


class _QueueBackend(Protocol):
    def __init__(self, broker_url: str) -> None:
        ...

    def bulk_get_sizes(self, queues: list[str]) -> list[tuple[str, int]]:
        ...

    def get_size(self, queue: str) -> int:
        ...

    def purge_queue(self, queue: str) -> int:
        ...


class RedisBackend:
    def __init__(self, broker_url: str) -> None:
        self.broker_url = broker_url

    @cached_property
    def client(self) -> StrictRedis:
        return StrictRedis.from_url(self.broker_url)

    def bulk_get_sizes(self, queues: list[str]) -> list[tuple[str, int]]:
        return [(queue, self.get_size(queue)) for queue in queues]

    def get_size(self, queue: str) -> int:
        return self.client.llen(queue)

    def purge_queue(self, queue: str) -> int:
        # This is slightly inaccurate since things could be queued between calling
        # LLEN and DEL, but it's close enough for this use case.
        size = self.get_size(queue)
        self.client.delete(queue)
        return size


class _ConnectionParams(TypedDict):
    host: str
    userid: str | None
    password: str | None
    virtual_host: str
    ssl: bool


class AmqpBackend:
    def __init__(self, broker_url: str) -> None:
        dsn = urlparse(broker_url)
        host, port = dsn.hostname, dsn.port
        if port is None:
            port = 5672
        has_ssl = dsn.scheme == "amqps"
        self.conn_info: _ConnectionParams = dict(
            host="%s:%d" % (host, port),
            userid=dsn.username,
            password=dsn.password,
            virtual_host=dsn.path[1:] or "/",
            ssl=has_ssl,
        )

    def get_conn(self) -> Connection:
        return Connection(**self.conn_info)

    def _get_size_from_channel(self, channel: Channel, queue: str) -> int:
        # In AMQP, the way to do this is to attempt to create a queue passively.
        # which is basically checking for it's existence (passive=True), this also
        # returns back the queue size.
        try:
            _, size, _ = channel.queue_declare(queue, passive=True)
        except Exception:
            return 0
        return size

    def bulk_get_sizes(self, queues: list[str]) -> list[tuple[str, int]]:
        sizes = []
        with self.get_conn() as conn:
            with conn.channel() as channel:
                for queue in queues:
                    sizes.append((queue, self._get_size_from_channel(channel, queue)))
                return sizes

    def get_size(self, queue: str) -> int:
        with self.get_conn() as conn:
            with conn.channel() as channel:
                return self._get_size_from_channel(channel, queue)

    def purge_queue(self, queue: str) -> int:
        with self.get_conn() as conn:
            with conn.channel() as channel:
                return channel.queue_purge(queue)


def get_backend_for_broker(broker_url: str) -> _QueueBackend:
    return backends[urlparse(broker_url).scheme](broker_url)


def get_queue_by_name(name: str) -> kombu.Queue:
    "Lookup a celery Queue object by it's name"
    for queue in settings.CELERY_QUEUES:
        if queue.name == name:
            return queue


backends: dict[str, type[_QueueBackend]] = {
    "redis": RedisBackend,
    "amqp": AmqpBackend,
    "amqps": AmqpBackend,
}

try:
    backend: _QueueBackend | None = get_backend_for_broker(settings.BROKER_URL)
except KeyError:
    backend = None
