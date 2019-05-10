from __future__ import absolute_import

from exam import fixture
import mock
from django.utils import timezone
import pytz
from datetime import datetime

from sentry.api.serializers import serialize
from sentry.testutils import APITestCase


class IncidentDetailsTest(APITestCase):
    endpoint = 'sentry-api-0-organization-incident-details'

    @fixture
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    @mock.patch('django.utils.timezone.now')
    def test_simple(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)

        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident(seen_by=[self.user])
        self.login_as(self.user)
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(incident.organization.slug, incident.id)

        expected = serialize(incident)

        user_data = serialize(self.user)
        user_data['lastSeen'] = timezone.now()
        seen_by = [user_data]

        assert resp.data['id'] == expected['id']
        assert resp.data['identifier'] == expected['identifier']
        assert resp.data['query'] == expected['query']
        assert resp.data['projects'] == expected['projects']
        assert resp.data['dateDetected'] == expected['dateDetected']
        assert resp.data['dateAdded'] == expected['dateAdded']
        assert resp.data['projects'] == expected['projects']
        assert resp.data['eventStats'] == expected['eventStats']
        assert resp.data['seenBy'] == seen_by

    def test_no_perms(self):
        incident = self.create_incident()
        self.login_as(self.create_user())
        with self.feature('organizations:incidents'):
            resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 403

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        self.login_as(self.user)
        resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 404
