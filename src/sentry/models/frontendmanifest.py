"""
sentry.models.frontendmanifest
~~~~~~~~~~~~~~~~~~~~
"""


from django.db import models
from django.utils import timezone

from sentry.db.models import JSONField, Model


class FrontendManifest(Model):
    __include_in_export__ = False

    version = models.CharField(max_length=128, null=False, db_index=True)
    date_created = models.DateTimeField(default=timezone.now)
    manifest = JSONField()
    is_production = models.BooleanField(null=True, db_index=True, default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_frontendmanifest"
        constraints = [
            models.UniqueConstraint(
                fields=["is_production"],
                name="unique_production_index",
                condition=models.Q(is_production=True),
            )
        ]
