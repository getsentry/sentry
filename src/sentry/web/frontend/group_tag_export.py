from __future__ import absolute_import

from django.http import Http404

from sentry.models import (
    EventUser, GroupTagValue, TagKey, TagKeyStatus, Group, get_group_with_redirect
)
from sentry.web.frontend.base import ProjectView
from sentry.web.frontend.mixins.csv import CsvMixin
from sentry.utils.query import RangeQuerySetWrapper


def attach_eventuser(project_id):
    def wrapped(items):
        users = EventUser.for_tags(project_id, [i.value for i in items])
        for item in items:
            item._eventuser = users.get(item.value)
    return wrapped


class GroupTagExportView(ProjectView, CsvMixin):
    required_scope = 'event:read'

    def get_header(self, key):
        if key == 'user':
            return self.get_user_header()
        return self.get_generic_header()

    def get_row(self, item, key):
        if key == 'user':
            return self.get_user_row(item)
        return self.get_generic_row(item)

    def get_generic_header(self):
        return (
            'value',
            'times_seen',
            'last_seen',
            'first_seen',
        )

    def get_generic_row(self, item):
        return (
            item.value,
            item.times_seen,
            item.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            item.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        )

    def get_user_header(self):
        return (
            'value',
            'id',
            'email',
            'username',
            'ip_address',
            'times_seen',
            'last_seen',
            'first_seen',
        )

    def get_user_row(self, item):
        euser = item._eventuser
        return (
            item.value,
            euser.ident if euser else '',
            euser.email if euser else '',
            euser.username if euser else '',
            euser.ip_address if euser else '',
            item.times_seen,
            item.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            item.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        )

    def get(self, request, organization, project, team, group_id, key):
        try:
            # TODO(tkaemming): This should *actually* redirect, see similar
            # comment in ``GroupEndpoint.convert_args``.
            group, _ = get_group_with_redirect(
                group_id,
                queryset=Group.objects.filter(project=project),
            )
        except Group.DoesNotExist:
            raise Http404

        if TagKey.is_reserved_key(key):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        # validate existance as it may be deleted
        try:
            TagKey.objects.get(
                project=group.project_id,
                key=lookup_key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise Http404

        if key == 'user':
            callbacks = [attach_eventuser(project.id)]
        else:
            callbacks = []

        queryset = RangeQuerySetWrapper(
            GroupTagValue.objects.filter(
                group=group,
                key=lookup_key,
            ),
            callbacks=callbacks,
        )

        filename = '{}-{}'.format(
            group.qualified_short_id or group.id,
            key,
        )

        return self.to_csv_response(queryset, filename, key=key)
