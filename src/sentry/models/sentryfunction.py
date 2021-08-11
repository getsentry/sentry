from django.db import models

from sentry.db.models import (
    ArrayField,
    BaseManager,
    DefaultFieldsModel,
    EncryptedJsonField,
    FlexibleForeignKey,
)


class SentryFunctionManager(BaseManager):
    def get_alertable_sentry_functions(self, organization_id):
        # TODO: check events
        functions = self.filter(
            organization_id=organization_id,
        )
        return filter(lambda fn: "alert" in fn.events, list(functions))


class SentryFunction(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.TextField()
    # putting code in here for simplicity
    # really belongs in an storage bucket
    code = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    author = models.TextField(null=True)
    overview = models.TextField(null=True)
    events = ArrayField(of=models.TextField, null=True)
    external_id = models.CharField(max_length=128, unique=True)
    env_variables = EncryptedJsonField(default=dict)

    objects = SentryFunctionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryfunction"
        unique_together = (("organization", "name"),)
