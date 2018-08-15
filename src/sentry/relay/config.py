from __future__ import absolute_import

import uuid

from datetime import datetime
from pytz import utc

from sentry.models import ProjectKey


def get_project_options(project, with_org=True):
    """Returns a dict containing the config for a project for the sentry relay"""
    project_keys = ProjectKey.objects.filter(
        project=project,
    ).all()

    public_keys = {}
    for project_key in list(project_keys):
        public_keys[project_key.public_key] = project_key.status == 0

    now = datetime.utcnow().replace(tzinfo=utc)

    rv = {
        'disabled': project.status > 0,
        'slug': project.slug,
        'lastFetch': now,
        'lastChange': project.get_option('sentry:relay-rev-lastchange', now),
        'rev': project.get_option('sentry:relay-rev', uuid.uuid4().hex),
        'publicKeys': public_keys,
        'config': {
            'allowedDomains': project.get_option('sentry:origins', ['*']),
        },
    }
    if with_org:
        rv.update(get_organization_options(project.organization))
    return rv


def get_organization_options(org):
    return {
        'trustedRelays': org.get_option('sentry:trusted-relays', []),
    }


def get_project_key_config(project_key):
    """Returns a dict containing the information for a specific project key"""
    return {
        'dsn': project_key.dsn_public,
    }
