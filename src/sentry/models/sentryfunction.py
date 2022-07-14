from django.db import models

from sentry.db.models import BaseManager, DefaultFieldsModel, FlexibleForeignKey


class SentryFunctionManager(BaseManager):
    def get_alertable_sentry_functions(self, organization_id):
        # TODO: check events
        functions = self.filter(
            organization_id=organization_id,
        )
        return filter(lambda fn: "alert" in fn.organization, list(functions))
        # needs to be changed


class SentryFunction(DefaultFieldsModel):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    author = models.TextField()
    external_id = models.CharField(max_length=128, unique=True)

    objects = SentryFunctionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryfunction"
        unique_together = (("organization", "slug"),)
