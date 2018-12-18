from __future__ import absolute_import, print_function

from sentry.coreapi import Auth, ClientApiHelper
from sentry.event_manager import EventManager
from sentry.models import Project
from sentry.web.api import process_event


def process_event_from_kafka(message):
    project = Project.objects.get_from_cache(pk=message['project_id'])

    remote_addr = message['remote_addr']
    helper = ClientApiHelper(
        agent=message['agent'],
        project_id=project.id,
        ip_address=remote_addr,
    )
    helper.context.bind_project(project)

    auth = Auth(message['auth'], message['auth'].pop('is_public'))
    helper.context.bind_auth(auth)

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

    return process_event(event_manager, project, key,
                         remote_addr, helper, attachments=None)
