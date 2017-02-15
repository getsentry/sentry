from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import (
    Activity, File, Release, ReleaseCommit, ReleaseFile, ReleaseProject
)
from sentry.testutils import APITestCase


class ReleaseDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(team=team1, organization=org)
        project2 = self.create_project(team=team2, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )
        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        ReleaseProject.objects.filter(
            project=project,
            release=release
        ).update(new_groups=5)

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['version'] == release.version
        assert response.data['newGroups'] == 5

        # no access
        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release2.version,
        })
        response = self.client.get(url)
        assert response.status_code == 404


class UpdateReleaseDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(team=team1, organization=org)
        project2 = self.create_project(team=team2, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )
        release2 = Release.objects.create(
            organization_id=org.id,
            version='12345678',
        )
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.put(url, {'ref': 'master'})

        assert response.status_code == 200, response.content
        assert response.data['version'] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == 'master'

        # no access
        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release2.version,
        })
        response = self.client.put(url, {'ref': 'master'})
        assert response.status_code == 404

    def test_commits(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(team=team, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.put(url, data={
            'commits': [
                {'id': 'a' * 40},
                {'id': 'b' * 40},
            ],
        })

        assert response.status_code == 200, (response.status_code, response.content)

        rc_list = list(ReleaseCommit.objects.filter(
            release=release,
        ).select_related('commit', 'commit__author').order_by('order'))
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id == org.id

    def test_activity_generation(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(team=team, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.put(url, data={
            'dateReleased': datetime.utcnow().isoformat() + 'Z',
        })

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=Activity.RELEASE,
            project=project,
            ident=release.version,
        )
        assert activity.exists()


class ReleaseDeleteTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(team=team, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)
        release_file = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(
                name='application.js',
                type='release.file',
            ),
            name='http://example.com/application.js'
        )

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not Release.objects.filter(id=release.id).exists()
        assert not ReleaseFile.objects.filter(id=release_file.id).exists()

    def test_existing_group(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(team=team, organization=org)

        release = Release.objects.create(
            organization_id=org.id,
            version='abcabcabc',
        )

        release.add_project(project)
        self.create_group(first_release=release)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse('sentry-api-0-organization-release-details', kwargs={
            'organization_slug': org.slug,
            'version': release.version,
        })
        response = self.client.delete(url)

        assert response.status_code == 400, response.content

        assert Release.objects.filter(id=release.id).exists()
