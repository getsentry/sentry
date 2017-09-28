from __future__ import absolute_import

from sentry import http, options
from sentry.api.base import Endpoint
from sentry.models import Activity, Group, Integration, Project
from sentry.utils import json

from .utils import build_attachment, build_workflow_message, logger


# https://api.slack.com/docs/message-threading
class SlackActionEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def on_status(self, request, integration, group, action, data):
        activity = Activity(type=Activity.SET_RESOLVED, group=group, project=group.project)

        payload = build_workflow_message(activity)
        payload.update({
            'thread_ts': data['message_ts'],
            'source_team': data['team']['id'],
            'channel': data['channel']['id'],
            'user': integration.metadata['bot_user_id'],
            'token': integration.metadata['bot_access_token'],
            'type': 'message',
            'as_user': True,
            'unfurl_links': False,
            'unfurl_media': False,
        })
        session = http.build_session()
        req = session.post('https://slack.com/api/chat.postMessage', data=payload)
        req.raise_for_status()
        resp = req.json()
        if not resp.get('ok'):
            logger.error('slack.action.response-error', extra={
                'error': resp.get('error'),
            })

    def post(self, request):
        logging_data = {}

        try:
            data = request.DATA
        except (ValueError, TypeError):
            logger.error('slack.action.invalid-json', extra=logging_data, exc_info=True)
            return self.respond(status=400)

        try:
            data = json.loads(data['payload'])
        except (KeyError, IndexError, TypeError, ValueError):
            logger.error('slack.action.invalid-payload', extra=logging_data, exc_info=True)
            return self.respond(status=400)

        event_id = data.get('event_id')
        team_id = data.get('team', {}).get('id')
        channel_id = data.get('channel', {}).get('id')
        user_id = data.get('user', {}).get('id')
        callback_id = data.get('callback_id')
        # TODO(dcramer): should we verify this here?
        # authed_users = data.get('authed_users')

        logging_data.update({
            'team_id': team_id,
            'channel_id': channel_id,
            'user_id': user_id,
            'event_id': event_id,
            'callback_id': callback_id,
        })

        token = data.get('token')
        if token != options.get('slack.verification-token'):
            logger.error('slack.action.invalid-token', extra=logging_data)
            return self.respond(status=401)

        logger.info('slack.action', extra=logging_data)

        try:
            integration = Integration.objects.get(
                provider='slack',
                external_id=team_id,
            )
        except Integration.DoesNotExist:
            logger.error('slack.action.invalid-team-id', extra=logging_data)
            return self.respond(status=403)

        logging_data['integration_id'] = integration.id

        # TODO
        # When your Action URL is triggered, you'll receive the user ID and team
        # ID for the invoker. If they do not yet exist in your system, send them
        # an ephemeral message containing a link they can follow to link accounts
        # on your website.
        action_list = data.get('actions')
        if not action_list:
            logger.error('slack.action.missing-actions', extra=logging_data)
            return self.respond(status=400)

        assert callback_id.startswith('issue:')
        group_id = callback_id.split('issue:', 1)[-1]

        try:
            group = Group.objects.get(
                project__in=Project.objects.filter(
                    organization__in=integration.organizations.all(),
                ),
                id=group_id,
            )
        except Group.DoesNotExist:
            logger.error('slack.action.invalid-issue', extra=logging_data)
            return self.respond(status=403)

        for action in action_list:
            if action['name'] == 'status':
                self.on_status(request, integration, group, action, data)
        return self.respond(build_attachment(group))
