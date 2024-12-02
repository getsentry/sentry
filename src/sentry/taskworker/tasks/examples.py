from __future__ import annotations

import logging

from sentry.taskworker.registry import taskregistry

logger = logging.getLogger(__name__)
exampletasks = taskregistry.create_namespace(name="examples")


@exampletasks.register(name="examples.say_hello")
def say_hello(name: str) -> None:
    print(f"Hello {name}")  # noqa
