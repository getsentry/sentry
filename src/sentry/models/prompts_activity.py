from __future__ import absolute_import, print_function

from django.db import models
from django.conf import settings
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr)


class PromptsActivity(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    project_id = BoundedPositiveIntegerField(db_index=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)
    feature = models.CharField(max_length=64)
    data = JSONField(default={})

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_prompt'
        unique_together = (('organization_id', 'user', 'feature'), )

    __repr__ = sane_repr('organization_id', 'project_id')
