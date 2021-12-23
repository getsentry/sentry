from django.db import models
from django.db.models.signals import pre_delete
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.mixin import PendingDeletionMixin, delete_pending_deletion_option
from sentry.db.models import BoundedPositiveIntegerField, JSONField, Model, sane_repr
from sentry.signals import pending_delete


class Repository(Model, PendingDeletionMixin):
    __include_in_export__ = True

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=200)
    url = models.URLField(null=True)
    provider = models.CharField(max_length=64, null=True)
    external_id = models.CharField(max_length=64, null=True)
    config = JSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices(), db_index=True
    )
    date_added = models.DateTimeField(default=timezone.now)
    integration_id = BoundedPositiveIntegerField(db_index=True, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_repository"
        unique_together = (
            ("organization_id", "name"),
            ("organization_id", "provider", "external_id"),
        )

    __repr__ = sane_repr("organization_id", "name", "provider")

    _rename_fields_on_pending_delete = frozenset(["name", "external_id"])

    def has_integration_provider(self):
        return self.provider and self.provider.startswith("integrations:")

    def get_provider(self):
        """
        :param provider:
            The unique string identifier for the service that provides repository hosting.
            This is used to route requests through the
        integration pipeline to a specialized provider.

            If no integration is available for this provider, this should be left unset.

          :returns:
             A
        subclass of :class:`RepositoryProvider`. If no suitable implementation could be found, ``None`` will be returned instead.
        """
        from sentry.plugins.base import bindings

        if self.has_integration_provider():
            provider_cls = bindings.get("integration-repository.provider").get(self.provider)
            return provider_cls(self.provider)

        provider_cls = bindings.get("repository.provider").get(self.provider)
        return provider_cls(self.provider)

    def generate_delete_fail_email(self, error_message):
        """
        Generate an email to send when a repository deletion fails.

        :param self: A :class:`Repository` instance.
        :param error_message: An error message
        explaining what went wrong during the deletion process.
        """
        from sentry.utils.email import MessageBuilder

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

    def rename_on_pending_deletion(self, fields=None):
        # Due to the fact that Repository is shown to the user
        # as it is pending deletion, this is added to display the fields
        # correctly to the user.
        self.config["pending_deletion_name"] = self.name
        super().rename_on_pending_deletion(fields, ["config"])

    def reset_pending_deletion_field_names(self):
        del self.config["pending_deletion_name"]
        super().reset_pending_deletion_field_names(["config"])


def on_delete(instance, actor=None, **kwargs):
    """
    Remove webhooks for repository providers that use repository level webhooks.
    This is called from sentry.tasks.deletion.run_deletion()
    """
    # If there is no provider, we don't have any webhooks, etc to delete
    if not instance.provider:
        return

    def handle_exception(e):
        """
        This function is used to handle exceptions that occur in the ``delete_organization`` method of the ``OrganizationIntegration`` class.

        :param e: The
        exception that occurred.
        :type e: Exception

            :param actor: The user who triggered the action resulting in this exception being raised. This
        parameter is optional and defaults to None if not specified. It will be passed as None if not specified or empty, but it can also be set explicitly to
        a value of 'None'. 
            :type actor: User

            :returns error_message - A concise reStructuredText docstring for the above function that explains what
        the code does without using general terms or examples.: str
        """
        from sentry.exceptions import InvalidIdentity, PluginError
        from sentry.shared_integrations.exceptions import IntegrationError

        if isinstance(e, (IntegrationError, PluginError, InvalidIdentity)):
            error = str(e)
        else:
            error = "An unknown error occurred"
        if actor is not None:
            msg = instance.generate_delete_fail_email(error)
            msg.send_async(to=[actor.email])

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
pre_delete.connect(delete_pending_deletion_option, sender=Repository, weak=False)
