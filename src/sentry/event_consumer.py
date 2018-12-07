from __future__ import absolute_import, print_function

from sentry.coreapi import Auth
from sentry.event_manager import EventManager
from sentry.web.api import process_event


def process_event_from_kafka(message):
    from sentry.models import Project
    from sentry.utils.imports import import_string

    project = Project.objects.get_from_cache(pk=message['project_id'])

    helper_cls = import_string(message['helper_cls'])
    remote_addr = message['remote_addr']
    helper = helper_cls(
        agent=message['agent'],
        project_id=project.id,
        ip_address=remote_addr,
    )
    auth = Auth(message['auth'], message['auth'].pop('is_public'))
    key = helper.project_key_from_auth(auth)
    data = message['data']
    version = data['version']

    event_manager = EventManager(
        data,
        project=project,
        key=key,
        auth=auth,
        client_ip=remote_addr,
        user_agent=helper.context.agent,
        version=version,
    )
    event_manager._normalized = True
    del data

    return process_event(event_manager, project, key, remote_addr, helper, attachments=None)
