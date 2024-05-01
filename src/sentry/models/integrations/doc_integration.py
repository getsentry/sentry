from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.fields.slug import SentrySlugField


@control_silo_model
class DocIntegration(Model):
    """
    Document based integrations can be found in Sentry, but are installed via code change.
    """

    __relocation_scope__ = RelocationScope.Excluded

    name = models.CharField(max_length=64)
    slug = SentrySlugField(max_length=64, unique=True, db_index=False)
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
