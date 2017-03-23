from __future__ import absolute_import

__all__ = ['Filter']

from sentry.models import ProjectOption
from sentry.signals import inbound_filter_toggled
from rest_framework import serializers


class FilterSerializer(serializers.Serializer):
    active = serializers.BooleanField()


class Filter(object):
    id = None
    description = None
    name = None
    default = False
    serializer_cls = FilterSerializer

    def __init__(self, project):
        self.project = project

    def is_enabled(self):
        return ProjectOption.objects.get_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            default='1' if self.default else '0',
        ) == '1'

    def enable(self, value=None):
        if value is None:
            value = {'active': True}

        ProjectOption.objects.set_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            value='1' if value.get('active', False) else '0',
        )

        if value:
            inbound_filter_toggled.send(project=self.project, sender=self)

    def disable(self):
        return self.enable(False)

    def test(self):
        return False
