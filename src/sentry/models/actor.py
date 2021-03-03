from enum import Enum

from django.db import models
from sentry.db.models import Model


class ActorType(Enum):
    TEAM = 0
    USER = 1


class Actor(Model):
    __core__ = True

    type = models.PositiveSmallIntegerField(
        choices=(
            (ActorType.TEAM, "team"),
            (ActorType.USER, "user"),
        )
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"
