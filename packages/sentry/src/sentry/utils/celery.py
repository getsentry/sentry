from random import randint

from celery.schedules import crontab


def crontab_with_minute_jitter(*args, **kwargs):
    kwargs["minute"] = randint(0, 59)
    return crontab(*args, **kwargs)
