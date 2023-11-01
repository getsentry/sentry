from typing import ClassVar

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    DefaultFieldsModel,
    EncryptedJsonField,
    FlexibleForeignKey,
    region_silo_only_model,
)
from sentry.db.models.fields.array import ArrayField


class SentryFunctionManager(BaseManager["SentryFunction"]):
    def get_sentry_functions(self, organization_id, event_type):
        functions = self.filter(organization_id=organization_id, events__contains=event_type)
        return functions


@region_silo_only_model
class SentryFunction(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    author = models.TextField()
    external_id = models.CharField(max_length=128, unique=True)
    overview = models.TextField(null=True)
    code = models.TextField(null=True)
    events = ArrayField(of=models.TextField, null=True)
    env_variables = EncryptedJsonField(default=dict)
    objects: ClassVar[SentryFunctionManager] = SentryFunctionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryfunction"
        unique_together = (("organization", "slug"),)
