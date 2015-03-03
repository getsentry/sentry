# -*- coding: utf-8 -*-

from __future__ import absolute_import

import json

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase


class GroupDetailsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
        })

    def test_simple(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')


class GroupListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-stream', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')


class GroupEventListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group-events', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')


class GroupTagListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group-tags', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')


class GroupEventDetailsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group-event', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
            'event_id': self.event.id,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')


class GroupEventJsonTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group-event-json', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
            'event_id_or_latest': self.event.id,
        })

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        data = json.loads(resp.content)
        assert data['id'] == self.event.event_id
