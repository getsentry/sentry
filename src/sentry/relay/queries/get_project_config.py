from __future__ import absolute_import

import uuid

from datetime import datetime
from pytz import utc
from sentry.models import Project, ProjectKey


def execute(relay, project_id, query):
    if not project_id:
        pass  # TODO(hazat): error handling

    project = Project.objects.select_related('organization').distinct().filter(
        id=project_id,
    ).get()
    if project is None:
        return None

    project_keys = ProjectKey.objects.filter(
        project=project,
    ).all()

    public_keys = {}
    for project_key in list(project_keys):
        public_keys[project_key.public_key] = project_key.status == 0

    # TODO(hazat): not use now
    now = datetime.utcnow().replace(tzinfo=utc)
    return {
        'disabled': project.status > 0,
        'slug': project.slug,
        'last_fetch': now,
        'last_change': now,
        'rev': uuid.uuid4().hex,
        'public_keys': public_keys,
        'config': {
            'allowed_domains': project.get_option('sentry:origins', [])
        }
    }
