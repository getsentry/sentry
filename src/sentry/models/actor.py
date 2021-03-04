from django.db import models
from django.db.models.signals import pre_save
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


def handle_actor_pre_save(instance, **kwargs):
    # we want to create an actor if we don't have one
    if not instance.actor and not instance.actor_id:
        instance.actor = Actor.objects.create(type=ACTOR_TYPES[type(instance).__name__.lower()])


pre_save.connect(
    handle_actor_pre_save, sender="sentry.Team", dispatch_uid="handle_actor_pre_save", weak=False
)
pre_save.connect(
    handle_actor_pre_save, sender="sentry.User", dispatch_uid="handle_actor_pre_save", weak=False
)
