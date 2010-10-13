from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase

from sentry.models import GroupedMessage
from sentry.plugins.sentry_redmine import conf
from sentry.plugins.sentry_redmine.models import CreateRedmineIssue

class CreateIssueTest(TestCase):
    fixtures = ['sentry/plugins/redmine/tests/fixtures/regression.json']
    urls = 'sentry.urls'

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.client.login(username='admin', password='admin')

    def test_basic_response(self):
        group = GroupedMessage.objects.all()[0]

        response = self.client.get(CreateRedmineIssue.get_url(group.pk))
        self.assertEquals(response.status_code, 200)
        self.assertTemplateUsed(response, 'sentry/plugins/redmine/create_issue.html')

    def test_issue_creation(self):
        group = GroupedMessage.objects.all()[0]

        response = self.client.post(CreateRedmineIssue.get_url(group.pk), {
            'subject': 'test',
            'description': 'foo',
        })
        self.assertEquals(response.status_code, 200)
        self.assertTemplateUsed(response, 'sentry/plugins/redmine/create_issue.html')
        