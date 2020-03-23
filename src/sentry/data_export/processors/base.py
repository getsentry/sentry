from __future__ import absolute_import


from sentry.models import Project

from ..base import ExportError


class ExportProcessor:
    def get_project(self, project_id):
        try:
            project = Project.objects.get(id=project_id)
            return project
        except Project.DoesNotExist:
            raise ExportError("Requested project does not exist")
