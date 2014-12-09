# -*- coding: utf-8 -*-

from __future__ import absolute_import

import json

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from exam import fixture

from sentry.models import GroupSeen, Group
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
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        assert resp.context['group'] == self.group
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team
        assert resp.context['organization'] == self.organization

        # ensure we've marked the group as seen
        assert GroupSeen.objects.filter(
            group=self.group, user=self.user).exists()


class GroupListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-stream', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
        })

    def setUp(self):
        super(GroupListTest, self).setUp()
        later = timezone.now()
        now = later - timedelta(hours=1)
        past = now - timedelta(hours=1)

        self.group1 = Group.objects.create(
            project=self.project,
            checksum='a' * 32,
            last_seen=now,
            first_seen=now,
            times_seen=5,
        )
        self.group2 = Group.objects.create(
            project=self.project,
            checksum='b' * 32,
            last_seen=later,
            first_seen=past,
            times_seen=50,
        )

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        assert 'event_list' in resp.context
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team
        assert resp.context['organization'] == self.organization

    def test_date_sort(self):
        self.login_as(self.user)
        resp = self.client.get(self.path + '?sort=date')
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        assert list(resp.context['event_list']) == [self.group2, self.group1]

    def test_new_sort(self):
        self.login_as(self.user)
        resp = self.client.get(self.path + '?sort=new')
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        print self.group1.score, self.group2.score
        assert list(resp.context['event_list']) == [self.group1, self.group2]

    def test_freq_sort(self):
        self.login_as(self.user)
        resp = self.client.get(self.path + '?sort=freq')
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        assert list(resp.context['event_list']) == [self.group2, self.group1]


class GroupEventListTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-group-events', kwargs={
            'organization_slug': self.organization.slug,
            'project_id': self.project.slug,
            'group_id': self.group.id,
        })

    def test_does_render(self):
        event = self.create_event(
            event_id='a' * 32, datetime=timezone.now() - timedelta(minutes=1))
        event2 = self.create_event(
            event_id='b' * 32, datetime=timezone.now())

        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team
        assert resp.context['group'] == self.group
        assert resp.context['organization'] == self.organization
        event_list = resp.context['event_list']
        assert len(event_list) == 2
        assert event_list[0] == event2
        assert event_list[1] == event


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
        self.assertTemplateUsed(resp, 'sentry/groups/tag_list.html')
        assert 'tag_list' in resp.context
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team
        assert resp.context['group'] == self.group
        assert resp.context['organization'] == self.organization


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
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team
        assert resp.context['group'] == self.group
        assert resp.context['event'] == self.event
        assert resp.context['organization'] == self.organization


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
