from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import analytics
from sentry import http, options
from sentry.api import client
from sentry.api.base import Endpoint
from sentry.models import Group, Integration, Project, IdentityProvider, Identity, ApiKey
from sentry.utils import json
from sentry.utils.http import absolute_uri

from .utils import build_attachment, logger

LINK_IDENTITY_MESSAGE = "Looks like you haven't linked your Sentry account with your Slack identity yet! <{associate_url}|Link your identity now> to perform actions in Sentry through Slack."

RESOLVE_SELECTOR = {
    'label': 'Resolve issue',
    'type': 'select',
    'name': 'resolve_type',
    'placeholder': 'Select the resolution target',
    'value': 'resolved',
    'options': [
        {
            'label': 'Immediately',
            'value': 'resolved'
        },
        {
            'label': 'In the next release',
            'value': 'resolved:inNextRelease'
        },
        {
            'label': 'In the current release',
            'value': 'resolved:inCurrentRelease'
        },
    ],
}


class SlackActionEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def on_assign(self, request, identity, group, action):
        assignee = action['selected_options'][0]['value']

        if assignee == 'none':
            assignee = None

        self.update_group(group, identity, {'assignedTo': assignee})
        analytics.record('integrations.slack.assign', actor_id=identity.user_id)

    def on_status(self, request, identity, group, action, data, integration):
        status = action['value']

        status_data = status.split(':', 1)
        status = {'status': status_data[0]}

        resolve_type = status_data[-1]

        if resolve_type == 'inNextRelease':
            status.update({'statusDetails': {'inNextRelease': True}})
        elif resolve_type == 'inCurrentRelease':
            status.update({'statusDetails': {'inRelease': 'latest'}})

        self.update_group(group, identity, status)

        analytics.record(
            'integrations.slack.status',
            status=status['status'],
            resolve_type=resolve_type,
            actor_id=identity.user_id
        )

    def update_group(self, group, identity, data):
        event_write_key = ApiKey(
            organization=group.project.organization,
            scope_list=['event:write'],
        )

        return client.put(
            path='/projects/{}/{}/issues/'.format(
                group.project.organization.slug,
                group.project.slug,
            ),
            params={'id': group.id},
            data=data,
            user=identity.user,
            auth=event_write_key,
        )

    def open_resolve_dialog(self, data, group, integration):
        # XXX(epurkhiser): In order to update the original message we have to
        # keep track of the response_url in the callback_id. Definitely hacky,
        # but seems like there's no other solutions [1]:
        #
        # [1]: https://stackoverflow.com/questions/46629852/update-a-bot-message-after-responding-to-a-slack-dialog#comment80795670_46629852
        callback_id = json.dumps({
            'issue': group.id,
            'orig_response_url': data['response_url'],
            'is_message': self.is_message(data),
        })

        dialog = {
            'callback_id': callback_id,
            'title': u'Resolve {}'.format(group.qualified_short_id),
            'submit_label': 'Resolve',
            'elements': [RESOLVE_SELECTOR],
        }

        payload = {
            'dialog': json.dumps(dialog),
            'trigger_id': data['trigger_id'],
            'token': integration.metadata['bot_access_token'],
        }

        session = http.build_session()
        req = session.post('https://slack.com/api/dialog.open', data=payload)
        resp = req.json()
        if not resp.get('ok'):
            logger.error('slack.action.response-error', extra={
                'error': resp.get('error'),
            })

    def construct_reply(self, attachment, is_message=False):
        # XXX(epurkhiser): Slack is inconsistent about it's expected responses
        # for interactive action requests.
        #
        #  * For _unfurled_ action responses, slack expects the entire
        #    attachment body used to replace the unfurled attachment to be at
        #    the top level of the json response body.
        #
        #  * For _bot posted message_ action responses, slack expects the
        #    attachment body used to replace the attachment to be within an
        #    `attachments` array.
        if is_message:
            attachment = {'attachments': [attachment]}

        return attachment

    def is_message(self, data):
        # XXX(epurkhsier): Used in coordination with construct_reply. Bot
        # posted messages will not have the type at all.
        return data.get('original_message', {}).get('type') == 'message'

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

        logging_data.update({
            'slack_team_id': team_id,
            'slack_channel_id': channel_id,
            'slack_user_id': user_id,
            'slack_event_id': event_id,
            'slack_callback_id': callback_id,
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

        callback_data = json.loads(callback_id)

        # Determine the issue group action is being taken on
        group_id = callback_data['issue']

        # Actions list may be empty when receiving a dialog response
        action_list = data.get('actions', [])

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

        # Determine the acting user by slack identity
        try:
            identity = Identity.objects.get(
                external_id=user_id,
                idp=IdentityProvider.objects.get(organization=group.organization),
            )
        except Identity.DoesNotExist:
            associate_url = absolute_uri(reverse('sentry-account-associate-identity', kwargs={
                'organization_slug': group.organization.slug,
                'provider_key': 'slack',
            }))

            return self.respond({
                'response_type': 'ephemeral',
                'replace_original': False,
                'text': LINK_IDENTITY_MESSAGE.format(associate_url=associate_url)
            })

        # Handle status dialog submission
        if data['type'] == 'dialog_submission' and 'resolve_type' in data['submission']:
            # Masquerade a status action
            action = {
                'name': 'status',
                'value': data['submission']['resolve_type'],
            }

            self.on_status(request, identity, group, action, data, integration)
            group = Group.objects.get(id=group.id)

            attachment = build_attachment(group, identity=identity, actions=[action])

            body = self.construct_reply(attachment, is_message=callback_data['is_message'])

            # use the original response_url to update the link attachment
            session = http.build_session()
            req = session.post(callback_data['orig_response_url'], json=body)
            resp = req.json()
            if not resp.get('ok'):
                logger.error('slack.action.response-error', extra={
                    'error': resp.get('error'),
                })

            return self.respond()

        # Usually we'll want to respond with the updated attachment including
        # the list of actions taken. However, when opening a dialog we do not
        # have anything to update the message with and will use the
        # response_url later to update it.
        defer_attachment_update = False

        # Handle interaction actions
        try:
            for action in action_list:
                action_type = action['name']

                if action_type == 'status':
                    self.on_status(request, identity, group, action, data, integration)
                elif action_type == 'assign':
                    self.on_assign(request, identity, group, action)
                elif action_type == 'resolve_dialog':
                    self.open_resolve_dialog(data, group, integration)
                    defer_attachment_update = True
        except client.ApiError as e:
            return self.respond({
                'response_type': 'ephemeral',
                'replace_original': False,
                'text': u'Action failed: {}'.format(e.body['detail']),
            })

        if defer_attachment_update:
            return self.respond()

        # Reload group as it may have been mutated by the action
        group = Group.objects.get(id=group.id)

        attachment = build_attachment(group, identity=identity, actions=action_list)
        body = self.construct_reply(attachment, is_message=self.is_message(data))

        return self.respond(body)
