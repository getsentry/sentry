from __future__ import absolute_import

import json
import re
import six

from sentry import http, options
from sentry.api.base import Endpoint
from sentry.models import Group, Integration, Project

from .utils import build_attachment, logger

# XXX(dcramer): this could be more tightly bound to our configured domain,
# but slack limits what we can unfurl anyways so its probably safe
_link_regexp = re.compile(r'^https?\://[^/]+/[^/]+/[^/]+/issues/(\d+)')


# XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will
# need refactored
class SlackEventEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def _parse_issue_id_from_url(self, link):
        match = _link_regexp.match(link)
        if not match:
            return
        try:
            return int(match.group(1))
        except (TypeError, ValueError):
            return

    def on_url_verification(self, request, data):
        return self.respond({
            'challenge': data['challenge'],
        })

    def on_link_shared(self, request, integration, token, data):
        issue_map = {}
        for item in data['links']:
            issue_id = self._parse_issue_id_from_url(item['url'])
            if not issue_id:
                continue
            issue_map[issue_id] = item['url']

        if not issue_map:
            return

        results = {
            g.id: g for g in Group.objects.filter(
                id__in=set(issue_map.keys()),
                project__in=Project.objects.filter(
                    organization__in=integration.organizations.all(),
                )
            )
        }
        if not results:
            return

        payload = {
            'token': integration.metadata['access_token'],
            'channel': data['channel'],
            'ts': data['message_ts'],
            'unfurls': json.dumps({
                v: build_attachment(results[k])
                for k, v in six.iteritems(issue_map)
                if k in results
            }),
            # 'user_auth_required': False,
            # 'user_auth_message': 'You can enable automatic unfurling of Sentry URLs by having a Sentry admin configure the Slack integration.',
            # we dont have a generic URL that this will work for your
            # 'user_auth_url': '...',
        }

        session = http.build_session()
        req = session.post('https://slack.com/api/chat.unfurl', data=payload)
        req.raise_for_status()
        resp = req.json()
        if not resp.get('ok'):
            logger.error('slack.event.unfurl-error', extra={'response': resp})

        return self.respond()

    # TODO(dcramer): implement app_uninstalled and tokens_revoked
    def post(self, request):
        logging_data = {}

        try:
            data = request.DATA
        except (ValueError, TypeError):
            logger.error('slack.event.invalid-json', extra=logging_data)
            return self.respond(status=400)

        event_id = data.get('event_id')
        team_id = data.get('team_id')
        api_app_id = data.get('api_app_id')
        # TODO(dcramer): should we verify this here?
        # authed_users = data.get('authed_users')

        logging_data.update({
            'slack_team_id': team_id,
            'slack_api_app_id': api_app_id,
            'slack_event_id': event_id,
        })

        token = data.get('token')
        if token != options.get('slack.verification-token'):
            logger.error('slack.event.invalid-token', extra=logging_data)
            return self.respond(status=400)
        payload_type = data.get('type')
        logger.info('slack.event.{}'.format(payload_type), extra=logging_data)
        if payload_type == 'url_verification':
            return self.on_url_verification(request, data)

        try:
            integration = Integration.objects.get(
                provider='slack',
                external_id=team_id,
            )
        except Integration.DoesNotExist:
            logger.error('slack.event.unknown-team-id', extra=logging_data)
            return self.respond(status=400)

        logging_data['integration_id'] = integration.id

        event_data = data.get('event')
        if not event_data:
            logger.error('slack.event.invalid-event-data', extra=logging_data)
            return self.respond(status=400)

        event_type = event_data.get('type')
        if not event_data:
            logger.error('slack.event.invalid-event-type', extra=logging_data)
            return self.respond(status=400)

        logging_data['slack_event_type'] = event_type
        if event_type == 'link_shared':
            resp = self.on_link_shared(request, integration, token, event_data)
        else:
            resp = None
        if resp:
            return resp
        return self.respond()
