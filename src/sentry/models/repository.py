from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)
from sentry.signals import pending_delete


class Repository(Model):
    __core__ = True

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=200)
    url = models.URLField(null=True)
    provider = models.CharField(max_length=64, null=True)
    external_id = models.CharField(max_length=64, null=True)
    config = JSONField(default=lambda: {})
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_repository'
        unique_together = (
            ('organization_id', 'name'),
            ('organization_id', 'provider', 'external_id')
        )

    __repr__ = sane_repr('organization_id', 'name', 'provider')

    def get_provider(self):
        from sentry.plugins import bindings
        provider_cls = bindings.get('repository.provider').get(self.provider)
        return provider_cls(self.provider)


def on_delete(instance, actor, **kwargs):
    instance.get_provider().delete_repository(
        repo=instance,
        actor=actor,
    )


pending_delete.connect(on_delete, sender=Repository, weak=False)
