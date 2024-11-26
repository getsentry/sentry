from __future__ import annotations

import logging

from sentry.taskworker.registry import taskregistry

logger = logging.getLogger(__name__)
demotasks = taskregistry.create_namespace(name="demos")


@demotasks.register(name="demos.say_hello")
def say_hello(name, age):
    print(f"{name} is {age} years old")  # noqa
