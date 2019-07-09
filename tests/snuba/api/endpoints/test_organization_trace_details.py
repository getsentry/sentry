from __future__ import absolute_import

import pytz
from datetime import datetime, timedelta

from django.core.urlresolvers import reverse
from django.utils import timezone
from mock import patch

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.utils.samples import load_data


class GetOrganizationTraceDetailsTest(APITestCase, SnubaTestCase):
    endpoint = 'sentry-api-0-organization-trace-details'
    trace_id = 'a7d67cf796774551a95be6543cacd459'

    def setUp(self):
        super(GetOrganizationTraceDetailsTest, self).setUp()
        self.url = reverse(self.endpoint, args=[self.organization.slug, self.trace_id])

    def test_requires_login(self):
        res = self.client.get(self.url)
        assert res.status_code == 401

    def test_no_access(self):
        self.login_as(self.user)
        res = self.client.get(self.url)
        assert res.status_code == 404

    def test_no_matching_trace(self):
        self.login_as(self.user)
        # Access project fixture to ensure it exists.
        self.project
        with self.feature('organizations:events-v2'):
            res = self.client.get(self.url)
        assert res.status_code == 404
        assert 'No trace' in res.content

    @patch('django.utils.timezone.now')
    def test_success(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]

        data = load_data('transaction')
        data.update({
            'timestamp': min_ago,
            'received': min_ago,
            'event_id': 'a' * 32
        })
        self.store_event(
            data=data,
            project_id=self.project.id
        )

        self.login_as(self.user)
        with self.feature('organizations:events-v2'):
            res = self.client.get(self.url)
        assert res.status_code == 200
        assert len(res.data) == 2

        parent_span = res.data[0]
        required_keys = set([
            'traceId', 'spanId', 'parentSpanId', 'description',
            'op', 'startTimestamp', 'endTimestamp', 'tags', 'data'
        ])
        assert required_keys.issuperset(set(parent_span.keys()))
        assert parent_span['op'] == 'transaction'
        assert parent_span['description'] == '/country_by_code/'

        child_span = res.data[1]
        assert required_keys.issuperset(set(child_span.keys()))
        assert child_span['op'] == 'db'
        assert child_span['parentSpanId'] == parent_span['spanId']

        assert child_span['traceId'] == parent_span['traceId']
