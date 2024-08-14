from random import randint
from typing import Any

from celery.schedules import crontab


def crontab_with_minute_jitter(*args: Any, **kwargs: Any) -> crontab:
    kwargs["minute"] = randint(0, 59)
    return crontab(*args, **kwargs)
