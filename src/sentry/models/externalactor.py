import logging

from django.db import models
from django.db.models.signals import post_delete, post_save

from sentry.db.models import BoundedPositiveIntegerField, DefaultFieldsModel, FlexibleForeignKey
from sentry.tasks.code_owners import update_code_owners_schema
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger(__name__)


class ExternalActor(DefaultFieldsModel):
    __include_in_export__ = False

    actor = FlexibleForeignKey("sentry.Actor", db_index=True, on_delete=models.CASCADE)
    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
            (ExternalProviders.MSTEAMS, "msteams"),
            (ExternalProviders.PAGERDUTY, "pagerduty"),
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITLAB, "gitlab"),
            (ExternalProviders.CUSTOM, "custom_scm"),
        ),
    )
    # The display name i.e. username, team name, channel name.
    external_name = models.TextField()
    # The unique identifier i.e user ID, channel ID.
    external_id = models.TextField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_externalactor"
        unique_together = (("organization", "provider", "external_name", "actor"),)

    def delete(self, **kwargs):
        from sentry.models import NotificationSetting

        # There is no foreign key relationship so we have to manually cascade.
        NotificationSetting.objects._filter(
            target_ids=[self.actor_id], provider=ExternalProviders(self.provider)
        ).delete()

        return super().delete(**kwargs)


post_save.connect(
    lambda instance, **kwargs: update_code_owners_schema.apply_async(
        kwargs={"organization": instance.organization, "integration": instance.integration}
    ),
    sender=ExternalActor,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: update_code_owners_schema.apply_async(
        kwargs={"organization": instance.organization, "integration": instance.integration}
    ),
    sender=ExternalActor,
    weak=False,
)
