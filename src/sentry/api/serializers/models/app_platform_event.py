from __future__ import absolute_import

import six
from time import time
from uuid import uuid4
from sentry.utils import json


class AppPlatformEvent(object):
    def __init__(self, resource, action, install, data, actor=None):
        self.resource = resource
        self.action = action
        self.install = install
        self.data = data
        self.actor = actor

    def get_actor(self):
        # when sentry auto assigns, auto resolves, etc.
        # or when an alert rule is triggered
        if not self.actor:
            return {
                'type': 'application',
                'id': 'sentry',
                'name': 'Sentry',
            }

        if self.actor.is_sentry_app:
            return {
                'type': 'application',
                'id': self.install.sentry_app.uuid,
                'name': self.install.sentry_app.name,
            }

        return {
            'type': 'user',
            'id': self.actor.id,
            'name': self.actor.name,
        }

    @property
    def body(self):
        return {
            'action': self.action,
            'installation': {
                'uuid': self.install.uuid,
            },
            'data': self.data,
            'actor': self.get_actor(),
        }

    @property
    def headers(self):
        body = json.dumps(self.body)
        request_uuid = uuid4().hex

        return {
            'Content-Type': 'application/json',
            'Request-ID': request_uuid,
            'Sentry-Hook-Resource': self.resource,
            'Sentry-Hook-Timestamp': six.text_type(int(time())),
            'Sentry-Hook-Signature': self.install.sentry_app.build_signature(body)
        }
