from __future__ import absolute_import

import json
import re
import six

from sentry import http
from sentry.api.base import Endpoint
from sentry.models import Group, Project

from .utils import build_attachment, logger
from .requests import SlackEventRequest, SlackRequestError

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
        try:
            slack_request = SlackEventRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        if slack_request.is_challenge():
            return self.on_url_verification(request, slack_request.data)

        if slack_request.type == 'link_shared':
            resp = self.on_link_shared(
                request,
                slack_request.integration,
                slack_request.data.get('token'),
                slack_request.data.get('event'),
            )

            if resp:
                return resp

        return self.respond()
