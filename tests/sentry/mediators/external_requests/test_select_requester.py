from __future__ import absolute_import

import responses

from sentry.mediators.external_requests import SelectRequester
from sentry.testutils import TestCase


class TestSelectRequester(TestCase):
    def setUp(self):
        super(TestSelectRequester, self).setUp()

        self.user = self.create_user(name='foo')
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug='boop', organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name='foo',
            organization=self.org,
            webhook_url='https://example.com',
            scopes=(),
        )

        self.install = self.create_sentry_app_installation(
            slug='foo',
            organization=self.org,
            user=self.user,
        )

    @responses.activate
    def test_makes_request(self):

        responses.add(
            method=responses.GET,
            url='https://example.com/get-issues?project=boop&installationId=f3d37e3a-9a87-4651-8463-d375118f4996',
            body='[{"label": "An Issue", "value": "12345"}]',
            status=200,
            content_type='application/json',
        )

        result = SelectRequester.run(
            install=self.install,
            project=self.project,
            uri='/get-issues',
        )

        assert result == [{'value': '12345', 'label': 'An Issue'}]
