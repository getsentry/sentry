import os

import asyncpg
from emmett55 import Pipe
from emmett55.extensions import Extension, Signals, listen_signal


class AsyncPG(Extension):
    __slots__ = ["pool"]

    def on_load(self):
        self.pool = None
        self.pipe = AsyncPGPipe(self)
        self.pipe_ctx = AsyncPGCtxPipe(self)

    async def build_pool(self):
        from django.conf import settings

        DB_CONF = settings.DATABASES["default"]
        POOL_SIZE = int(os.environ.get("APIGW_DB_POOL_SIZE", "4"))

        self.pool = await asyncpg.create_pool(
            user=DB_CONF["USER"],
            password=DB_CONF["PASSWORD"],
            database=DB_CONF["NAME"],
            host=DB_CONF["HOST"],
            port=DB_CONF["PORT"],
            min_size=POOL_SIZE,
            max_size=POOL_SIZE,
        )

    @listen_signal(Signals.after_loop)
    def _init_pool(self, loop):
        loop.run_until_complete(self.build_pool())


class AsyncPGPipe(Pipe):
    __slots__ = ["ext"]

    def __init__(self, ext):
        self.ext = ext

    async def pipe(self, next_pipe, **kwargs):
        async with self.ext.pool.acquire() as conn:
            kwargs["db"] = conn
            return await next_pipe(**kwargs)


class AsyncPGCtxPipe(Pipe):
    __slots__ = ["ext"]

    def __init__(self, ext):
        self.ext = ext

    def pipe(self, next_pipe, **kwargs):
        kwargs["db_ctx"] = self.ext.pool
        return next_pipe(**kwargs)


def pgq_from_djq(q: str, p: int) -> str:
    for i in range(p):
        q = q.replace("%s", f"${i + 1}", 1)
    return q
