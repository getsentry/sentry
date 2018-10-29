from __future__ import absolute_import, print_function

from django.db import models
from django.conf import settings
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (FlexibleForeignKey, Model, sane_repr)


class PromptsActivity(Model):
    """ Records user interaction with various feature prompts in product"""
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization', null=True)
    project = FlexibleForeignKey('sentry.Project', null=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)
    feature = models.CharField(max_length=64, null=False)
    # typically will include a dismissed/snoozed timestamp or something similar
    data = JSONField(default={})

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_prompt'
        unique_together = (('user', 'feature', 'organization', 'project'), )

    __repr__ = sane_repr('user_id', 'feature')
