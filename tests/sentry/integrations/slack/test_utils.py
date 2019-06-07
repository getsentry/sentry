from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.integrations.slack.utils import (
    build_incident_attachment,
    LEVEL_TO_COLOR,
)
from sentry.testutils import TestCase
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        logo_url = absolute_uri(get_asset_url('sentry', 'images/sentry-email-avatar.png'))

        incident = self.create_incident()
        title = '{} (#{})'.format(incident.title, incident.identifier)
        assert build_incident_attachment(incident) == {
            'fallback': title,
            'title': title,
            'title_link': absolute_uri(reverse(
                'sentry-incident',
                kwargs={
                    'organization_slug': incident.organization.slug,
                    'incident_id': incident.identifier,
                },
            )),
            'text': ' ',
            'fields': [
                {'title': 'Status', 'value': 'Open', 'short': True},
                {'title': 'Events', 'value': 0, 'short': True},
                {'title': 'Users', 'value': 0, 'short': True},
            ],
            'mrkdwn_in': ['text'],
            'footer_icon': logo_url,
            'footer': 'Sentry Incident',
            'ts': to_timestamp(incident.date_started),
            'color': LEVEL_TO_COLOR['error'],
            'actions': [],
        }
