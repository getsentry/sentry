from __future__ import absolute_import

from sentry.models import Project


class ProcessingError(Exception):
    pass


class BaseProcessor:
    def get_project(self, project_id):
        # TODO(Leander): Add environment checking to this module
        # TODO(Leander): Ensure this is used for group_tag_export.py
        # TODO(Leander): Update tests if need be
        try:
            project = Project.objects.get(id=project_id)
            return project
        except Project.DoesNotExist:
            raise ProcessingError("Requested project does not exist")
