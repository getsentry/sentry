from django.core.urlresolvers import reverse
from rest_framework.test import APITestCase
from sentry.testutils import BaseTestCase


class EventIndexTest(BaseTestCase, APITestCase):
    def test_simple(self):
        self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)

        self.client.force_authenticate(user=self.user)
        url = reverse('sentry-api-1-event-list', kwargs={
            'project_id': self.project.id, 'team_slug': self.team.slug})
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert response.data == 'ok'
