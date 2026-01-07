from __future__ import annotations

from typing import Any

from django.contrib.postgres.fields.array import ArrayField
from django.db import models, router, transaction
from django.db.models.signals import pre_delete
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.constants import DEFAULT_CODE_REVIEW_TRIGGERS, ObjectStatus
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.jsonfield import LegacyTextJSONField
from sentry.db.pending_deletion import (
    delete_pending_deletion_option,
    rename_on_pending_deletion,
    reset_pending_deletion_field_names,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings
from sentry.organizations.services.organization.service import organization_service
from sentry.signals import pending_delete
from sentry.users.services.user import RpcUser
from sentry.utils.email import MessageBuilder


@region_silo_model
class Repository(Model):
    __relocation_scope__ = RelocationScope.Global

    organization_id = BoundedBigIntegerField(db_index=True)
    name = models.CharField(max_length=200)
    url = models.URLField(null=True)
    provider = models.CharField(max_length=64, null=True)
    # The external_id is the id of the repo in the provider's system. (e.g. GitHub's repo id)
    external_id = models.CharField(max_length=64, null=True)
    config = LegacyTextJSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices(), db_index=True
    )
    date_added = models.DateTimeField(default=timezone.now)
    integration_id = BoundedPositiveIntegerField(db_index=True, null=True)
    languages = ArrayField(models.TextField(), default=list)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repository"
        unique_together = (("organization_id", "provider", "external_id"),)

    __repr__ = sane_repr("organization_id", "name", "provider")

    def has_integration_provider(self):
        return self.provider and self.provider.startswith("integrations:")

    def get_provider(self):
        from sentry.plugins.base import bindings

        if self.has_integration_provider():
            provider_cls = bindings.get("integration-repository.provider").get(self.provider)
            return provider_cls(self.provider)

        provider_cls = bindings.get("repository.provider").get(self.provider)
        return provider_cls(self.provider)

    def generate_delete_fail_email(self, error_message):
        new_context = {
            "repo": self,
            "error_message": error_message,
            "provider_name": self.get_provider().name,
        }

        return MessageBuilder(
            subject="Unable to Delete Repository Webhooks",
            context=new_context,
            template="sentry/emails/unable-to-delete-repo.txt",
            html_template="sentry/emails/unable-to-delete-repo.html",
        )

    def send_delete_fail_email(self, error_message, actor_email):
        from sentry.notifications.platform.service import NotificationService
        from sentry.notifications.platform.target import GenericNotificationTarget
        from sentry.notifications.platform.templates.repository import UnableToDeleteRepository
        from sentry.notifications.platform.types import (
            NotificationProviderKey,
            NotificationTargetResourceType,
        )

        data = UnableToDeleteRepository(
            repository_name=self.name,
            provider_name=self.get_provider().name,
            error_message=error_message,
        )

        organization_context = organization_service.get_organization_by_id(id=self.organization_id)
        if organization_context is not None and NotificationService.has_access(
            organization_context.organization, data.source
        ):
            NotificationService(data=data).notify_async(
                targets=[
                    GenericNotificationTarget(
                        provider_key=NotificationProviderKey.EMAIL,
                        resource_type=NotificationTargetResourceType.EMAIL,
                        resource_id=actor_email,
                    )
                ]
            )
        else:
            msg = self.generate_delete_fail_email(error_message)
            msg.send_async([actor_email])

    # pending deletion implementation
    _pending_fields = ("name", "external_id")

    def rename_on_pending_deletion(self) -> None:
        # Due to the fact that Repository is shown to the user
        # as it is pending deletion, this is added to display the fields
        # correctly to the user.
        self.config["pending_deletion_name"] = self.name
        rename_on_pending_deletion(
            self.organization_id, self, self._pending_fields, extra_fields_to_save=("config",)
        )

    def reset_pending_deletion_field_names(self) -> bool:
        del self.config["pending_deletion_name"]
        return reset_pending_deletion_field_names(
            self.organization_id, self, self._pending_fields, extra_fields_to_save=("config",)
        )

    def delete_pending_deletion_option(self) -> None:
        delete_pending_deletion_option(self.organization_id, self)

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_json(json, SanitizableField(model_name, "config"), {})
        sanitizer.set_string(json, SanitizableField(model_name, "external_id"))
        sanitizer.set_string(json, SanitizableField(model_name, "provider"))
        json["fields"]["languages"] = "[]"

    def save(self, *args: Any, **kwargs: Any) -> None:
        is_new = self.pk is None
        with transaction.atomic(router.db_for_write(Repository)):
            super().save(*args, **kwargs)
            if is_new:
                self._handle_auto_enable_code_review()

    def _handle_auto_enable_code_review(self) -> None:
        """
        When a new repository is created, auto enable code review if applicable.
        """
        SUPPORTED_PROVIDERS = {"integrations:github"}

        if self.provider not in SUPPORTED_PROVIDERS:
            return

        if OrganizationOption.objects.get_value(
            organization=self.organization_id,
            key="sentry:auto_enable_code_review",
            default=False,
        ):
            triggers = OrganizationOption.objects.get_value(
                organization=self.organization_id,
                key="sentry:default_code_review_triggers",
                default=DEFAULT_CODE_REVIEW_TRIGGERS,
            )
            if not isinstance(triggers, list):
                triggers = DEFAULT_CODE_REVIEW_TRIGGERS

            # ON_COMMAND_PHRASE is always enabled
            if CodeReviewTrigger.ON_COMMAND_PHRASE not in triggers:
                triggers.append(CodeReviewTrigger.ON_COMMAND_PHRASE)

            RepositorySettings.objects.get_or_create(
                repository_id=self.id,
                defaults={"enabled_code_review": True, "code_review_triggers": triggers},
            )


def on_delete(instance, actor: RpcUser | None = None, **kwargs):
    """
    Remove webhooks for repository providers that use repository level webhooks.
    This is called from sentry.deletions.tasks.run_deletion()
    """
    # If there is no provider, we don't have any webhooks, etc to delete
    if not instance.provider:
        return

    def handle_exception(e):
        from sentry.exceptions import InvalidIdentity, PluginError
        from sentry.shared_integrations.exceptions import IntegrationError

        if isinstance(e, (IntegrationError, PluginError, InvalidIdentity)):
            error = str(e)
        else:
            error = "An unknown error occurred"
        if actor is not None:
            instance.send_delete_fail_email(error, actor.email)

    if instance.has_integration_provider():
        try:
            instance.get_provider().on_delete_repository(repo=instance)
        except Exception as exc:
            handle_exception(exc)
    else:
        try:
            instance.get_provider().delete_repository(repo=instance, actor=actor)
        except Exception as exc:
            handle_exception(exc)


pending_delete.connect(on_delete, sender=Repository, weak=False)
pre_delete.connect(
    lambda instance, **k: instance.delete_pending_deletion_option(),
    sender=Repository,
    weak=False,
)
