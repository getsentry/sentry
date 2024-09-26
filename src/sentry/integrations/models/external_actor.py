import logging

from django.db import models, router, transaction
from django.db.models import Q
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.services.replica import control_replica_service
from sentry.integrations.types import ExternalProviders
from sentry.notifications.services import notifications_service

logger = logging.getLogger(__name__)


@region_silo_model
class ExternalActor(ReplicatedRegionModel):
    __relocation_scope__ = RelocationScope.Excluded

    category = OutboxCategory.EXTERNAL_ACTOR_UPDATE

    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    team = FlexibleForeignKey("sentry.Team", null=True, db_index=True, on_delete=models.CASCADE)
    user_id = HybridCloudForeignKey("sentry.User", null=True, db_index=True, on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="CASCADE")
    provider = BoundedPositiveIntegerField(
        choices=(
            (ExternalProviders.EMAIL, "email"),
            (ExternalProviders.SLACK, "slack"),
            (ExternalProviders.MSTEAMS, "msteams"),
            (ExternalProviders.PAGERDUTY, "pagerduty"),
            (ExternalProviders.GITHUB, "github"),
            (ExternalProviders.GITHUB_ENTERPRISE, "github_enterprise"),
            (ExternalProviders.GITLAB, "gitlab"),
            # TODO: do migration to delete this from database
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
        unique_together = (
            ("organization", "provider", "external_name", "team_id"),
            ("organization", "provider", "external_name", "user_id"),
        )

        constraints = [
            models.CheckConstraint(
                condition=Q(user_id__isnull=False) | Q(team_id__isnull=False),
                name="external_actor_team_or_user",
            ),
        ]

    def delete(self, *args, **kwargs):
        from sentry.integrations.services.integration import integration_service

        # TODO: Extract this out of the delete method into the endpoint / controller instead.
        if self.team is not None:
            integration = integration_service.get_integration(integration_id=self.integration_id)
            if integration:
                install = integration.get_installation(organization_id=self.organization.id)
                team = self.team
                install.notify_remove_external_team(external_team=self, team=team)
                notifications_service.remove_notification_settings_for_provider_team(
                    team_id=team.id, provider=ExternalProviders(self.provider)
                )

        return super().delete(*args, **kwargs)

    def handle_async_replication(self, shard_identifier: int) -> None:
        from sentry.notifications.services.serial import serialize_external_actor

        control_replica_service.upsert_external_actor_replica(
            external_actor=serialize_external_actor(self)
        )


def process_resource_change(instance, **kwargs):
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.tasks.codeowners import update_code_owners_schema

    def _spawn_task():
        try:
            update_code_owners_schema.apply_async(
                kwargs={
                    "organization": instance.organization,
                    "integration": instance.integration_id,
                }
            )
        except (Organization.DoesNotExist, Project.DoesNotExist):
            pass

    transaction.on_commit(_spawn_task, router.db_for_write(Project))


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=ExternalActor,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=ExternalActor,
    weak=False,
)
