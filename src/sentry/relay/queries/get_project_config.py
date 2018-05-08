from __future__ import absolute_import

from sentry.models import Project
from sentry.relay.config import Config


def execute(relay, project_id, query):
    if not project_id:
        pass  # TODO(hazat): error handling

    try:
        project = Project.objects.select_related('organization').distinct().filter(
            id=project_id,
        ).get()
    except Project.DoesNotExist:
        return None

    config = Config(project)
    return config.get_project_options()
