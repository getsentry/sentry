from __future__ import absolute_import

import six

from sentry.models import Event
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute


class IssueSyncMixin(object):
    def get_group_title(self, group, event, **kwargs):
        return event.error()

    def get_group_body(self, group, event, **kwargs):
        result = []
        for interface in six.itervalues(event.interfaces):
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return '\n\n'.join(result)

    def get_group_description(self, group, event, **kwargs):
        output = [
            absolute_uri(group.get_absolute_url()),
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend([
                '',
                '```',
                body,
                '```',
            ])
        return '\n'.join(output)

    def get_create_issue_config(self, group, **kwargs):
        event = group.get_latest_event()
        if event is not None:
            Event.objects.bind_nodes([event], 'data')

        return [
            {
                'name': 'title',
                'label': 'Title',
                'default': self.get_group_title(group, event, **kwargs),
                'type': 'string',
            }, {
                'name': 'description',
                'label': 'Description',
                'default': self.get_group_description(group, event, **kwargs),
                'type': 'textarea',
            }
        ]
