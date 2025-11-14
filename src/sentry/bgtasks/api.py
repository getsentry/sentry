from __future__ import annotations
from typing import int

import logging
import random
import threading
import time
from collections.abc import Callable, Generator
from contextlib import contextmanager

from django.conf import settings

from sentry.conf.types.bgtask import BgTaskConfig

logger = logging.getLogger("sentry.bgtasks")
tasks: dict[str, BgTask] = {}


def bgtask(
    roles: list[str] | None = None, interval: int = 60
) -> Callable[[Callable[[], None]], BgTask]:
    def decorator(f: Callable[[], None]) -> BgTask:
        return BgTask(callback=f, roles=roles, interval=interval)

    return decorator


class BgTask:
    def __init__(
        self, callback: Callable[[], None], roles: list[str] | None = None, interval: int = 60
    ) -> None:
        self.callback = callback
        self.roles = roles or []
        self.interval = interval
        self.running = False

    @property
    def name(self) -> str:
        return f"{self.callback.__module__}:{self.callback.__name__}"

    def run(self) -> None:
        if self.running:
            return
        self.running = True

        next_run = time.time() + self.interval * random.random()
        while self.running:
            now = time.time()
            if now >= next_run:
                try:
                    self.callback()
                except Exception:
                    logging.exception("bgtask.failed", extra=dict(task_name=self.name))
                next_run = now + self.interval
            time.sleep(1.0)

    def reconfigure(self, cfg: BgTaskConfig) -> None:
        if "roles" in cfg:
            self.roles = cfg["roles"]
        if "interval" in cfg:
            self.interval = cfg["interval"]

    def spawn_daemon(self) -> None:
        if self.running:
            return
        logger.info("bgtask.spawn", extra=dict(task_name=self.name))
        t = threading.Thread(target=self.run, daemon=True)
        t.start()

    def stop(self) -> None:
        logger.info("bgtask.stop", extra=dict(task_name=self.name))
        self.running = False


def get_task(task_name: str) -> BgTask:
    module, task_cls = task_name.split(":", 1)
    mod = __import__(module, None, None, [task_cls])
    obj = getattr(mod, task_cls)
    if not isinstance(obj, BgTask):
        raise TypeError(f"expected BgTask @ {task_name} got {obj!r}")
    return obj


def spawn_bgtasks(role: str) -> None:
    for import_name, cfg in settings.BGTASKS.items():
        task = get_task(import_name)
        # This is already running
        if task.name in tasks:
            continue
        task.reconfigure(cfg)
        if role not in task.roles:
            continue
        task.spawn_daemon()
        tasks[task.name] = task


def shutdown_bgtasks() -> None:
    for task_name, task in list(tasks.items()):
        task.stop()
        tasks.pop(task_name, None)


@contextmanager
def managed_bgtasks(role: str) -> Generator[None]:
    spawn_bgtasks(role)
    try:
        yield
    finally:
        shutdown_bgtasks()
