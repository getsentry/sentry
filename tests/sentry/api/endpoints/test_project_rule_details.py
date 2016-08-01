from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Rule, RuleStatus
from sentry.testutils import APITestCase


class ProjectRuleDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(team=team, name='foo')
        self.create_project(team=team, name='bar')

        rule = project1.rule_set.all()[0]

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project1.organization.slug,
            'project_slug': project1.slug,
            'rule_id': rule.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(rule.id)


class UpdateProjectRuleTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label='foo')

        conditions = [{
            'id': 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
            'key': 'foo',
            'match': 'eq',
            'value': 'bar',
        }]

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'rule_id': rule.id,
        })
        response = self.client.put(url, data={
            'name': 'hello world',
            'actionMatch': 'any',
            'actions': [{'id': 'sentry.rules.actions.notify_event.NotifyEventAction'}],
            'conditions': conditions,
        }, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(rule.id)

        rule = Rule.objects.get(id=rule.id)
        assert rule.label == 'hello world'
        assert rule.data['action_match'] == 'any'
        assert rule.data['actions'] == [{'id': 'sentry.rules.actions.notify_event.NotifyEventAction'}]
        assert rule.data['conditions'] == conditions

    def test_invalid_rule_node_type(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label='foo')

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'rule_id': rule.id,
        })
        response = self.client.put(url, data={
            'name': 'hello world',
            'actionMatch': 'any',
            'conditions': [{'id': 'sentry.rules.actions.notify_event.NotifyEventAction'}],
        }, format='json')

        assert response.status_code == 400, response.content

    def test_invalid_rule_node(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label='foo')

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'rule_id': rule.id,
        })
        response = self.client.put(url, data={
            'name': 'hello world',
            'actionMatch': 'any',
            'actions': [{'id': 'foo'}],
        }, format='json')

        assert response.status_code == 400, response.content

    def test_rule_form_not_valid(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label='foo')

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'rule_id': rule.id,
        })
        response = self.client.put(url, data={
            'name': 'hello world',
            'actionMatch': 'any',
            'conditions': [{'id': 'sentry.rules.conditions.tagged_event.TaggedEventCondition'}],
        }, format='json')

        assert response.status_code == 400, response.content


class DeleteProjectRuleTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()

        rule = Rule.objects.create(project=project, label='foo')

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'rule_id': rule.id,
        })
        response = self.client.delete(url)

        assert response.status_code == 202, response.content

        rule = Rule.objects.get(id=rule.id)
        assert rule.status == RuleStatus.PENDING_DELETION
