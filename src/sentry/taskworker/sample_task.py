import logging

from sentry.taskworker.config import taskregistry
from sentry.taskworker.retry import Retry

namespace = taskregistry.create_namespace("hackweek", "foobar", "barfoo", None)

logger = logging.getLogger("foo_the_bars_worker")
# Sample event with a task execution, remove when we have some actual tasks


@namespace.register("foo_the_bars", idempotent=None, deadline=None, retry=None)
def foo_the_bars(*args, **kwargs):
    logger.info(args)
    logger.info(kwargs)


@namespace.register(
    "do_not_foo_the_bars",
    idempotent=None,
    deadline=None,
    retry=Retry(
        times=3,
        on=(Exception,),
    ),
)
def do_not_foo_the_bars(*args, **kwargs):
    logger.error("kaboom")
    raise Exception("If you expected this to pass, I have no idea why")
