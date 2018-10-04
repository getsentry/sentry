from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import (BoundedPositiveIntegerField, Model, sane_repr)
from sentry.signals import pending_delete


class Repository(Model):
    __core__ = True

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=200)
    url = models.URLField(null=True)
    provider = models.CharField(max_length=64, null=True)
    external_id = models.CharField(max_length=64, null=True)
    config = JSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)
    integration_id = BoundedPositiveIntegerField(db_index=True, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_repository'
        unique_together = (
            ('organization_id', 'name'), ('organization_id', 'provider', 'external_id')
        )

    __repr__ = sane_repr('organization_id', 'name', 'provider')

    def has_integration_provider(self):
        return self.provider and self.provider.startswith('integrations:')

    def get_provider(self):
        from sentry.plugins import bindings
        if self.has_integration_provider():
            provider_cls = bindings.get('integration-repository.provider').get(self.provider)
            return provider_cls(self.provider)

        provider_cls = bindings.get('repository.provider').get(self.provider)
        return provider_cls(self.provider)

    def generate_delete_fail_email(self, error_message):
        from sentry.utils.email import MessageBuilder

        new_context = {
            'repo': self,
            'error_message': error_message,
            'provider_name': self.get_provider().name,
        }

        return MessageBuilder(
            subject='Unable to Delete Repository Webhooks',
            context=new_context,
            template='sentry/emails/unable-to-delete-repo.txt',
            html_template='sentry/emails/unable-to-delete-repo.html',
        )


def on_delete(instance, actor=None, **kwargs):
    # If there is no provider, we don't have any webhooks, etc to delete
    if not instance.provider:
        return

    # TODO(lb): I'm assuming that this is used by integrations... is it?
    def handle_exception(exc):
        from sentry.exceptions import InvalidIdentity, PluginError
        from sentry.integrations.exceptions import IntegrationError
        if isinstance(exc, (IntegrationError, PluginError, InvalidIdentity)):
            error = exc.message
        else:
            error = 'An unknown error occurred'
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
            instance.get_provider().delete_repository(
                repo=instance,
                actor=actor,
            )
        except Exception as exc:
            handle_exception(exc)


pending_delete.connect(on_delete, sender=Repository, weak=False)
