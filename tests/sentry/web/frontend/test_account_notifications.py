# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import ProjectStatus, UserOption, UserOptionValue
from sentry.testutils import TestCase


class NotificationSettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings-notifications')

    def params(self, without=()):
        params = {
            'alert_email': 'foo@example.com',
        }
        return dict((k, v) for k, v in six.iteritems(params) if k not in without)

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        user = self.create_user('foo@example.com')
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, team=team)
        team2 = self.create_team(organization=organization)
        self.create_project(organization=organization, team=team, status=ProjectStatus.PENDING_DELETION)
        self.create_project(organization=organization, team=team2)
        self.create_member(organization=organization, user=user, teams=[project.team])
        self.login_as(user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/notifications.html')
        assert 'form' in resp.context
        assert 'settings_form' in resp.context
        assert 'reports_form' in resp.context
        assert len(resp.context['project_forms']) == 1

    def test_valid_params(self):
        self.login_as(self.user)

        params = self.params()

        resp = self.client.post(self.path, params)
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(user=self.user, project=None)

        assert options.get('alert_email') == 'foo@example.com'

    def test_can_change_workflow(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {
            'workflow_notifications': '1',
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(
            user=self.user, project=None
        )

        assert options.get('workflow:notifications') == '0'

        resp = self.client.post(self.path, {
            'workflow_notifications': '',
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(
            user=self.user, project=None
        )

        assert options.get('workflow:notifications') == \
            UserOptionValue.participating_only

    def test_can_change_subscribe_by_default(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {
            'subscribe_by_default': '1',
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(
            user=self.user, project=None
        )

        assert options.get('subscribe_by_default') == '1'

    def test_can_disable_reports(self):
        self.login_as(self.user)

        org1 = self.create_organization(name='foo', owner=self.user)
        org2 = self.create_organization(name='bar', owner=self.user)

        resp = self.client.post(self.path, {
            'reports-organizations': org1.id,
        })
        assert resp.status_code == 302

        options = UserOption.objects.get_all_values(
            user=self.user, project=None
        )

        disabled_orgs = set(options.get('reports:disabled-organizations', []))
        assert org1.id not in disabled_orgs
        assert org2.id in disabled_orgs
