from __future__ import absolute_import

import six


from uuid import uuid4

from sentry.models import OrganizationOption


def delete_pending_deletion_option(instance, **kwargs):
    if not issubclass(instance.__class__, PendingDeletionMixin):
        return
    instance.delete_pending_deletion_option()


class PendingDeletionMixin(object):
    _rename_fields_on_pending_delete = []

    def build_pending_deletion_key(self):
        return 'pending-delete:%s:%s' % (self.__class__, self.id)

    def rename_on_pending_deletion(self, fields=None):
        fields = fields or self._rename_fields_on_pending_delete
        original_data = {}

        for field in fields:
            original_data[field] = getattr(self, field)
            setattr(self, field, uuid4().hex)

        self.save()
        original_data['id'] = self.id
        original_data['model'] = self.__class__
        OrganizationOption.objects.create(
            organization_id=self.organization_id,
            key=self.build_pending_deletion_key(),
            value=original_data,
        )

    def get_pending_deletion_option(self):
        return OrganizationOption.objects.get(
            organization_id=self.organization_id,
            key=self.build_pending_deletion_key(),
        )

    def reset_pending_deletion_field_names(self):
        original_data = self.get_pending_deletion_option().value
        for field_name, field_value in six.iteritems(original_data):
            if field_name in ('id', 'model'):
                continue
            setattr(self, field_name, field_value)
        self.save()

    def delete_pending_deletion_option(self):
        option = self.get_pending_deletion_option()
        option.delete()
