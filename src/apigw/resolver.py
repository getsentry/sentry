import asyncio
import itertools
import socket
from collections import defaultdict
from typing import Any
from urllib.parse import urlsplit

from emmett55.extensions import Extension, Signals, listen_signal


class Resolver(Extension):
    __slots__ = ["_resolve", "pools", "rr", "tasks"]

    default_config = {
        "addrs": [],
        "interval": 5,
    }

    def on_load(self) -> None:
        self.pools: dict[str, list[str]] = defaultdict(list)
        self.rr: dict[str, Any] = defaultdict(itertools.count)

    @listen_signal(Signals.after_loop)
    def _init_pool(self, loop: Any) -> None:
        self._resolve = loop.getaddrinfo
        for addr in self.config.addrs:
            try:
                loop.run_until_complete(self._refresh(addr))
            except Exception:
                pass
        self.tasks = [loop.create_task(self.resolve(addr)) for addr in self.config.addrs]

    @staticmethod
    def _rebuild_addr(parts: Any, ip: str) -> str:
        rv = f"{parts.scheme}://{ip}"
        if parts.port is not None:
            rv = f"{rv}:{parts.port}"
        return rv

    async def _refresh(self, addr: str) -> None:
        addr_parts = urlsplit(addr)
        resolved = await self._resolve(
            addr_parts.hostname,
            addr_parts.port,
            type=socket.SOCK_STREAM,
        )
        ips = {res[4] for res in resolved}
        if not ips:
            return
        self.pools[addr] = [self._rebuild_addr(addr_parts, ip[0]) for ip in ips]

    async def resolve(self, addr: str) -> None:
        try:
            while True:
                await asyncio.sleep(self.config.interval)
                try:
                    await self._refresh(addr)
                except Exception:
                    pass
        except asyncio.CancelledError:
            pass

    def get_upstream(self, addr: str) -> str | None:
        pool = self.pools[addr]
        if not pool:
            return None
        idx = self.rr[addr]
        return pool[next(idx) % len(pool)]
