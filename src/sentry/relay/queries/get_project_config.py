from __future__ import absolute_import

import uuid

from datetime import datetime
from pytz import utc
from sentry.models import Project, ProjectKey


def execute(query):
    project_id = query.get('projectId', None)
    public_key = query.get('publicKey', None)
    if not project_id:
        pass  # TODO(hazat): error handling
    if not public_key:
        pass  # TODO(hazat): error handling

    project = Project.objects.select_related('organization').distinct().filter(
        id=project_id,
    ).get()

    project_keys = ProjectKey.objects.filter(
        project=project,
    ).all()

    public_keys = {}
    for project_key in list(project_keys):
        public_keys[project_key.public_key] = project_key.status == 0

    # TODO(hazat): not use now
    now = datetime.utcnow().replace(tzinfo=utc)
    return {
        'status': 'ok',
        'result': {
            'disabled': project.status > 0,
            'slug': project.slug,
            'lastFetch': now,
            'lastChange': now,
            'rev': uuid.uuid4().hex,
            'publicKeys': public_keys,
            'config': {
                'allowedDomains': project.get_option('sentry:origins', [])
            }
        }
    }
