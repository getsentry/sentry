from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SudoTest(APITestCase):
    def test_sudo_required_del_org(self):
        org = self.create_organization()
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': org.slug
        })

        user = self.create_user(email='foo@example.com', password='test')
        self.create_member(
            organization=org,
            user=user,
            role='owner',
        )

        self.login_as(user)

        response = self.client.delete(url)
        assert response.status_code == 403
        assert response.data['sudoRequired']
