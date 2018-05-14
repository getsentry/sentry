from __future__ import absolute_import

import uuid

from datetime import datetime
from pytz import utc
from sentry.models import Project, ProjectKey
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

    project_keys = ProjectKey.objects.filter(
        project=project,
    ).all()

    public_keys = {}
    for project_key in list(project_keys):
        public_keys[project_key.public_key] = project_key.status == 0

    # TODO(hazat): not use now
    now = datetime.utcnow().replace(tzinfo=utc)
    config = Config(project)

    return {
        'disabled': project.status > 0,
        'slug': project.slug,
        'lastFetch': now,
        'lastChange': now,
        'rev': uuid.uuid4().hex,
        'publicKeys': public_keys,
        'config': config.get_project_options(),
    }
