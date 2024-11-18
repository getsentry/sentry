from __future__ import annotations

import logging

from sentry.taskworker.registry import taskregistry

logger = logging.getLogger(__name__)
demotasks = taskregistry.create_namespace(name="demos")


@demotasks.register(name="demos.say_hello")
def say_hello(name):
    # logger.info("hello %s", name) need to fix logging now that we are running this in another process
    print(f"{name}")  # noqa
