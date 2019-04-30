"""
sentry.projectoptions.manager
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2019 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six
import uuid
import bisect

from datetime import datetime
from pytz import utc


class WellKnownProjectOption(object):

    def __init__(self, key, default=None, epoch_defaults=None):
        self.key = key
        self.default = default
        self.epoch_defaults = sorted((epoch_defaults or {}).items())

    def get_default(self, project):
        if self.epoch_defaults:
            from sentry.models import ProjectOption
            epoch = ProjectOption.objects.get_option_epoch(project)
            idx = bisect.bisect(self.epoch_defaults, (epoch, None))
            try:
                return self.epoch_defaults[idx][1]
            except IndexError:
                pass
        return self.default


class ProjectOptionsManager(object):
    """Project options used to be implemented in a relatively ad-hoc manner
    in the past.  The project manager still uses the functionality of the
    """

    def __init__(self):
        self.registry = {}

    def lookup_well_known_key(self, key):
        return self.registry.get(key)

    def set(self, project, key, value):
        from sentry.models import ProjectOption
        self.update_rev_for_option(project)
        return ProjectOption.objects.set_value(project, key, value)

    def isset(self, project, key):
        return project.get_option(project, key, Ellipsis) is not Ellipsis

    def get(self, project, key, default=None):
        from sentry.models import ProjectOption
        return ProjectOption.objects.get_value(project, key, default)

    def delete(self, project, key):
        from sentry.models import ProjectOption
        self.update_rev_for_option(project)
        return ProjectOption.objects.unset_value(self, project, key)

    def update_rev_for_option(self, project):
        from sentry.models import ProjectOption
        ProjectOption.objects.set_value(self, 'sentry:relay-rev', uuid.uuid().hex)
        ProjectOption.objects.set_value(
            self,
            'sentry:relay-rev-lastchange',
            datetime.utcnow().replace(
                tzinfo=utc))

    def register(
        self,
        key,
        default=None,
        epoch_defaults=None,
    ):
        self.registry[key] = WellKnownProjectOption(
            key=key,
            default=default,
            epoch_defaults=epoch_defaults,
        )

    def all(self):
        """
        Return an interator for all keys in the registry.
        """
        return six.itervalues(self.registry)
