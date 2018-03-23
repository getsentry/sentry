from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, FlexibleForeignKey


# TODO: Should this be ProjectSlugHistory
class ProjectRedirect(Model):
    __core__ = True

    redirect_slug = models.SlugField(null=True, db_index=True)
    project = FlexibleForeignKey('sentry.Project')
    organization = FlexibleForeignKey('sentry.Organization')
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectredirect'
        unique_together = (('organization', 'redirect_slug'),)
