from __future__ import absolute_import

__all__ = ['Filter']

from sentry.models import ProjectOption


class Filter(object):
    def __init__(self, project):
        self.project = project

    def is_enabled(self):
        return ProjectOption.objects.get_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            default='0',
        ) == '1'

    def enable(self, status=True):
        ProjectOption.objects.set_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            value='1' if status else '0',
        )

    def disable(self):
        return self.enable(False)

    def test(self):
        return False
