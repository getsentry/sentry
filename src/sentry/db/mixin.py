from __future__ import absolute_import

import logging
import six

from uuid import uuid4

from sentry.models import OrganizationOption

logger = logging.getLogger('sentry.deletions')


def delete_pending_deletion_option(instance, **kwargs):
    if hasattr(instance, 'delete_pending_deletion_option'):
        instance.delete_pending_deletion_option()


class PendingDeletionMixin(object):
    _rename_fields_on_pending_delete = frozenset()

    def build_pending_deletion_key(self):
        return 'pending-delete:%s:%s' % (self.__class__.__name__, self.id)

    def rename_on_pending_deletion(self, fields=None):
        fields = fields or self._rename_fields_on_pending_delete
        original_data = {}

        for field in fields:
            original_data[field] = getattr(self, field)
            setattr(self, field, uuid4().hex)

        self.save()
        original_data['id'] = self.id
        original_data['model'] = self.__class__.__name__
        OrganizationOption.objects.create(
            organization_id=self.organization_id,
            key=self.build_pending_deletion_key(),
            value=original_data,
        )
        logger.info(
            'rename-on-pending-deletion',
            extra={
                'organization_id': self.organization_id,
                'model': original_data['model'],
                'id': original_data['id'],
            }
        )

    def get_pending_deletion_option(self):
        return OrganizationOption.objects.get(
            organization_id=self.organization_id,
            key=self.build_pending_deletion_key(),
        )

    def reset_pending_deletion_field_names(self):
        try:
            option = self.get_pending_deletion_option()
        except OrganizationOption.DoesNotExist:
            logger.info(
                'reset-on-pending-deletion.does-not-exist',
                extra={
                    'organization_id': self.organization_id,
                    'model': self.__class__.__name__,
                    'id': self.id,
                }
            )
            return False

        for field_name, field_value in six.iteritems(option.value):
            if field_name in ('id', 'model'):
                continue
            setattr(self, field_name, field_value)
        self.save()
        logger.info(
            'reset-on-pending-deletion.success',
            extra={
                'organization_id': self.organization_id,
                'model': self.__class__.__name__,
                'id': self.id,
            }
        )
        return True

    def delete_pending_deletion_option(self):
        try:
            option = self.get_pending_deletion_option()
        except OrganizationOption.DoesNotExist:
            return
        option.delete()
        logger.info(
            'delete-pending-deletion-option.success',
            extra={
                'organization_id': self.organization_id,
                'model': self.__class__.__name__,
                'id': self.id,
            }
        )
