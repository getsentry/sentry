from __future__ import absolute_import

from base64 import b64encode
from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import ApiKey, Activity, Release, ReleaseCommit, ReleaseProject
from sentry.testutils import APITestCase


class OrganizationReleaseListTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(team=team1, organization=org)
        project2 = self.create_project(team=team2, organization=org2)
        project3 = self.create_project(team=team1, organization=org)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org2.id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project3)

        release4 = Release.objects.create(
            organization_id=org.id,
            version='4',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release4.add_project(project3)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]['version'] == release3.version
        assert response.data[1]['version'] == release4.version
        assert response.data[2]['version'] == release1.version

    def test_query_filter(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(team=team, organization=org)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        release = Release.objects.create(
            organization_id=org.id,
            version='foobar',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release.add_project(project)

        release2 = Release.objects.create(
            organization_id=org.id,
            version='sdfsdfsdf',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release2.add_project(project)

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

    def test_project_permissions(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(team=team1, organization=org)
        project2 = self.create_project(team=team2, organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project1)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['version'] == release3.version
        assert response.data[1]['version'] == release1.version


class OrganizationReleaseCreateTest(APITestCase):
    def test_minimal(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )
        project2 = self.create_project(
            name='bar',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

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
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = Release.objects.create(version='1.2.1',
                                         organization=org)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug]
        })

        # should be 201 because project was added
        assert response.status_code == 201, response.content
        assert Release.objects.filter(
            version='1.2.1', organization=org
        ).count() == 1
        # make sure project was added
        assert ReleaseProject.objects.filter(
            release=release, project=project
        ).exists()

    def test_activity(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )
        project2 = self.create_project(
            name='bar',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = Release.objects.create(version='1.2.1',
                                         date_released=datetime.utcnow(),
                                         organization=org)
        release.add_project(project)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug]
        })
        assert response.status_code == 208, response.content

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug, project2.slug]
        })

        # should be 201 because 1 project was added
        assert response.status_code == 201, response.content
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

    def test_version_whitespace(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })

        response = self.client.post(url, data={
            'version': '1.2.3\n',
            'projects': [project.slug]
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '\n1.2.3',
            'projects': [project.slug]
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.\n2.3',
            'projects': [project.slug]
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3\f',
            'projects': [project.slug]
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3\t',
            'projects': [project.slug]
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3+dev',
            'projects': [project.slug]
        })
        assert response.status_code == 201, response.content
        assert response.data['version'] == '1.2.3+dev'

        release = Release.objects.get(
            organization_id=org.id,
            version=response.data['version'],
        )
        assert not release.owner

    def test_features(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'owner': self.user.email,
            'projects': [project.slug]
        })

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            organization_id=org.id,
            version=response.data['version'],
        )
        assert release.owner == self.user

    def test_commits(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'commits': [
                {'id': 'a' * 40},
                {'id': 'b' * 40},
            ],
            'projects': [project.slug]
        })

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data['version']

        release = Release.objects.get(
            organization_id=org.id,
            version=response.data['version'],
        )

        rc_list = list(ReleaseCommit.objects.filter(
            release=release,
        ).select_related('commit', 'commit__author').order_by('order'))
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id

    def test_bad_project_slug(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(
            name='foo',
            organization=org,
            team=team
        )

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project.slug, 'banana']
        })
        assert response.status_code == 400
        assert 'Invalid project slugs' in response.content

    def test_project_permissions(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(team=team1, organization=org)
        project2 = self.create_project(team=team2, organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)

        release1 = Release.objects.create(
            organization_id=org.id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org.id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project1)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project1.slug, project2.slug]
        })

        assert response.status_code == 400
        assert 'Invalid project slugs' in response.content

        response = self.client.post(url, data={
            'version': '1.2.1',
            'projects': [project1.slug]
        })

        assert response.status_code == 201, response.content

    def test_api_key(self):
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        org2 = self.create_organization()

        team1 = self.create_team(organization=org)
        project1 = self.create_project(team=team1, organization=org)
        release1 = Release.objects.create(
            organization_id=org.id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)

        url = reverse('sentry-api-0-organization-releases', kwargs={
            'organization_slug': org.slug
        })

        # test right org, wrong permissions level
        bad_api_key = ApiKey.objects.create(
            organization=org,
            scope_list=['project:read'],
        )
        response = self.client.post(url,
            data={
                'version': '1.2.1',
                'projects': [project1.slug]
            }, HTTP_AUTHORIZATION='Basic ' + b64encode('{}:'.format(bad_api_key.key)))
        assert response.status_code == 403

        # test wrong org, right permissions level
        wrong_org_api_key = ApiKey.objects.create(
            organization=org2,
            scope_list=['project:write'],
        )
        response = self.client.post(url,
            data={
                'version': '1.2.1',
                'projects': [project1.slug]
            }, HTTP_AUTHORIZATION='Basic ' + b64encode('{}:'.format(wrong_org_api_key.key)))
        assert response.status_code == 403

        # test right org, right permissions level
        good_api_key = ApiKey.objects.create(
            organization=org,
            scope_list=['project:write'],
        )
        response = self.client.post(url,
            data={
                'version': '1.2.1',
                'projects': [project1.slug]
            }, HTTP_AUTHORIZATION='Basic ' + b64encode('{}:'.format(good_api_key.key)))
        assert response.status_code == 201, response.content
