from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class GroupIndexTest(APITestCase):
    def test_simple(self):
        self.create_group(checksum='a' * 32)
        self.create_group(checksum='b' * 32)

        self.client.force_authenticate(user=self.user)
        url = reverse('sentry-api-0-group-list', kwargs={
            'project_id': self.project.id, 'team_slug': self.team.slug})
        response = self.client.get(url, format='json')
        assert response.status_code == 200
