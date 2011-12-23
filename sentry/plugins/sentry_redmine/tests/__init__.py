"""
Configuring Redmine for these tests:

- Create a project called sentry
- Run a Redmine server locally on port 3000 (default webrick usage)
- Create an account with user/pass of sentry/sentry

Note: this does not test with API_KEY as that only works under a modified Redmine
      environment (e.g. DISQUS branch)

"""

from django.contrib.auth.models import User
from django.test import TestCase

from sentry.models import Group
from sentry.plugins.sentry_redmine import conf
from sentry.plugins.sentry_redmine.models import CreateRedmineIssue, RedmineIssue


class CreateIssueTest(TestCase):
    fixtures = ['sentry/plugins/sentry_redmine/tests/fixtures/regression.json']
    urls = 'sentry.web.urls'

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.client.login(username='admin', password='admin')

        conf.REDMINE_URL = 'http://localhost:3000'
        conf.REDMINE_PROJECT_SLUG = 'sentry'

    def test_basic_response(self):
        group = Group.objects.all()[0]

        response = self.client.get(CreateRedmineIssue.get_url(group.pk))
        self.assertEquals(response.status_code, 200)
        self.assertTemplateUsed(response, 'sentry/plugins/redmine/create_issue.html')

    def test_anonymous_issue_creation(self):
        conf.REDMINE_USERNAME = None
        conf.REDMINE_PASSWORD = None

        group = Group.objects.all()[0]

        response = self.client.post(CreateRedmineIssue.get_url(group.pk), {
            'subject': 'test',
            'description': 'foo',
        }, follow=True)
        self.assertEquals(response.status_code, 200)
        self.assertTemplateUsed(response, 'sentry/groups/details.html')

        self.assertTrue(RedmineIssue.objects.filter(group=group).exists())

        group = Group.objects.get(pk=group.pk)
        self.assertTrue(group.data['redmine']['issue_id'] > 0)

    def test_http_auth_issue_creation(self):
        conf.REDMINE_USERNAME = 'sentry'
        conf.REDMINE_PASSWORD = 'sentry'

        group = Group.objects.all()[0]

        response = self.client.post(CreateRedmineIssue.get_url(group.pk), {
            'subject': 'test',
            'description': 'foo',
        }, follow=True)
        self.assertEquals(response.status_code, 200)
        self.assertTemplateUsed(response, 'sentry/groups/details.html')

        self.assertTrue(RedmineIssue.objects.filter(group=group).exists())

        group = Group.objects.get(pk=group.pk)
        self.assertTrue(group.data['redmine']['issue_id'] > 0)
