from __future__ import absolute_import

import csv
import six

from django.http import Http404, StreamingHttpResponse
from django.utils.text import slugify

from sentry.models import (
    GroupTagValue, TagKey, TagKeyStatus, Group, get_group_with_redirect
)
from sentry.web.frontend.base import ProjectView


# Prevent execution of arbitrary Excel functions from user input.
# See:
#   https://www.owasp.org/index.php/CSV_Excel_Macro_Injection
#   http://www.contextis.com/resources/blog/comma-separated-vulnerabilities/
def clean(value):
    if not value:
        return value
    if value[0] in ('=', '+', '-', '@'):
        value = "'" + value
    return value.rstrip()


# Python 2 doesn't support unicode with CSV, but Python 3 does via
# the encoding param
if six.PY3:
    def get_row(row):
        return (
            clean(row.value),
            six.text_type(row.times_seen),
            row.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            row.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        )
else:
    def get_row(row):
        return (
            clean(row.value.encode('utf-8')),
            six.text_type(row.times_seen),
            row.last_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            row.first_seen.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        )


# csv.writer doesn't provide a non-file interface
# https://docs.djangoproject.com/en/1.9/howto/outputting-csv/#streaming-large-csv-files
class Echo(object):
    def write(self, value):
        return value


class GroupTagExportView(ProjectView):
    required_scope = 'event:read'

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

        queryset = GroupTagValue.objects.filter(
            group=group,
            key=lookup_key,
        )

        def row_iter():
            yield ('value', 'times_seen', 'last_seen', 'first_seen')
            for row in queryset.iterator():
                yield get_row(row)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(r) for r in row_iter()),
            content_type='text/csv',
        )
        response['Content-Disposition'] = 'attachment; filename="{}-{}.csv"'.format(
            group.qualified_short_id or group.id, slugify(key)
        )
        return response
