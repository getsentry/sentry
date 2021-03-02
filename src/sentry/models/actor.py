from enum import Enum

from django.db import models
from sentry.db.models import Model, FlexibleForeignKey


class ActorType(Enum):
    TEAM = 0
    USER = 1


class Actor(Model):
    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    type = models.PositiveSmallIntegerField(
        choices=(
            (ActorType.TEAM, "team"),
            (ActorType.USER, "user"),
        )
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"
