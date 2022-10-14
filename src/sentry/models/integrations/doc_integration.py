from django.db import models

from sentry.db.models import Model, control_silo_with_replication_model
from sentry.db.models.fields.jsonfield import JSONField


@control_silo_with_replication_model
class DocIntegration(Model):
    """
    Document based integrations can be found in Sentry, but are installed via code change.
    """

    __include_in_export__ = False

    name = models.CharField(max_length=64)
    slug = models.CharField(max_length=64, unique=True)
    author = models.CharField(max_length=255)
    description = models.TextField()
    url = models.URLField()
    popularity = models.PositiveSmallIntegerField(null=True, default=1)
    # Quickly hide/show integration, used for logo uploads.
    is_draft = models.BooleanField(default=True)

    # Allow future extensions by adding more metadata.
    # To start, only { resources: [{title, link}] }.
    metadata = JSONField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_docintegration"
