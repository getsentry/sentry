# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import ProjectKey, ProjectKeyStatus, TagKey
from sentry.testutils import TestCase

logger = logging.getLogger(__name__)


class ManageProjectKeysTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-project-keys', args=[self.organization.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/projects/keys.html')
        assert 'key_list' in resp.context


class NewProjectKeyTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-new-project-key', args=[self.organization.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_generates_new_key_and_redirects(self):
        keycount = ProjectKey.objects.filter(project=self.project).count()
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 302
        newkeycount = ProjectKey.objects.filter(project=self.project).count()
        assert newkeycount == keycount + 1


class RemoveProjectKeyTest(TestCase):
    def setUp(self):
        super(RemoveProjectKeyTest, self).setUp()
        self.key = ProjectKey.objects.create(project=self.project)

    @fixture
    def path(self):
        return reverse('sentry-remove-project-key', args=[self.organization.slug, self.project.id, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_does_not_respond_to_get(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_removes_key_and_redirects(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert not ProjectKey.objects.filter(id=self.key.id).exists()


class EnableProjectKeyTest(TestCase):
    def setUp(self):
        super(EnableProjectKeyTest, self).setUp()
        self.key = ProjectKey.objects.create(
            project=self.project,
            status=ProjectKeyStatus.INACTIVE,
        )

    @fixture
    def path(self):
        return reverse('sentry-enable-project-key', args=[self.organization.slug, self.project.id, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_does_not_respond_to_get(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_does_enable(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        key = ProjectKey.objects.get(id=self.key.id)
        assert key.status == ProjectKeyStatus.ACTIVE


class DisableProjectKeyTest(TestCase):
    def setUp(self):
        super(DisableProjectKeyTest, self).setUp()
        self.key = ProjectKey.objects.create(
            project=self.project,
            status=ProjectKeyStatus.ACTIVE,
        )

    @fixture
    def path(self):
        return reverse('sentry-disable-project-key', args=[self.organization.slug, self.project.id, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_does_not_respond_to_get(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_does_enable(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        key = ProjectKey.objects.get(id=self.key.id)
        assert key.status == ProjectKeyStatus.INACTIVE


class ManageProjectTagsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-project-tags', args=[self.organization.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_simple(self):
        TagKey.objects.create(project=self.project, key='site')
        TagKey.objects.create(project=self.project, key='url')
        TagKey.objects.create(project=self.project, key='os')

        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/projects/manage_tags.html')
        assert resp.context['organization'] == self.organization
        assert resp.context['team'] == self.team
        assert resp.context['project'] == self.project
        tag_list = [t.key for t in resp.context['tag_list']]
        assert 'site' in tag_list
        assert 'url' in tag_list
        assert 'os' in tag_list
