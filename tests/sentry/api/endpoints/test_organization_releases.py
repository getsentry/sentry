from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import Activity, Release, ReleaseProject
from sentry.testutils import APITestCase


class OrganizationReleaseListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization()
        org2 = self.create_organization()

        release1 = Release.objects.create(
            organization_id=org.id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )

        release2 = Release.objects.create(
            organization_id=org.id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )

        release3 = Release.objects.create(
            organization_id=org.id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )

        Release.objects.create(
            organization_id=org2.id,
            version='1',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]['version'] == release3.version
        assert response.data[1]['version'] == release2.version
        assert response.data[2]['version'] == release1.version

    def test_query_filter(self):
        self.login_as(user=self.user)
        org = self.create_organization()

        release = Release.objects.create(
            organization_id=org.id,
            version='foobar',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )

        Release.objects.create(
            organization_id=org.id,
            version='sdfsdfsdf',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.get(url + '?query=foo', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['version'] == release.version

        response = self.client.get(url + '?query=bar', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0


class OrganizationReleaseCreateTest(APITestCase):
    def test_minimal(self):
        self.login_as(user=self.user)
        org = self.create_organization()

        project = self.create_project(name='foo', organization=org)
        project2 = self.create_project(name='bar', organization=org)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug,
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug, project2.slug]
        })

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            version=response.data['version'],
        )
        assert not release.owner
        assert release.organization == org
        assert ReleaseProject.objects.filter(
            release=release, project=project
        ).exists()
        assert ReleaseProject.objects.filter(
            release=release, project=project2
        ).exists()

    def test_duplicate(self):
        self.login_as(user=self.user)

        org = self.create_organization()

        release = Release.objects.create(version='1.2.1',
                                         organization=org)

        project = self.create_project(name='foo', organization=org)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug]
        })

        assert response.status_code == 208, response.content
        assert Release.objects.filter(
            version='1.2.1', organization=org
        ).count() == 1
        # make sure project was added
        assert ReleaseProject.objects.filter(
            release=release, project=project
        ).exists()

    def test_activity(self):
        self.login_as(user=self.user)

        org = self.create_organization()

        release = Release.objects.create(version='1.2.1',
                                         date_released=datetime.utcnow(),
                                         organization=org)

        project = self.create_project(name='foo', organization=org)
        release.add_project(project)
        project2 = self.create_project(name='bar', organization=org)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug, project2.slug]
        })

        assert response.status_code == 208, response.content
        assert not Activity.objects.filter(
            type=Activity.RELEASE,
            project=project,
            ident=release.version
        ).exists()
        assert Activity.objects.filter(
            type=Activity.RELEASE,
            project=project2,
            ident=release.version
        ).exists()
