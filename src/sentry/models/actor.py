from django.db import models
from sentry.db.models import Model

ACTOR_TYPES = {"team": 0, "user": 1}


class Actor(Model):
    __core__ = True

    type = models.PositiveSmallIntegerField(
        choices=(
            (ACTOR_TYPES["team"], "team"),
            (ACTOR_TYPES["user"], "user"),
        )
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"
