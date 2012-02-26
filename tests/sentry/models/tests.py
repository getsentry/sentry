from __future__ import absolute_import


from sentry.models import Project, ProjectMember, Group, Event, \
  MessageFilterValue, MessageCountByMinute, FilterValue

from tests.base import TestCase


class ProjectTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.project = Project.objects.get(id=1)

    def test_migrate(self):
        project2 = Project.objects.create(name='Test')
        self.project.merge_to(project2)

        self.assertFalse(Project.objects.filter(pk=1).exists())
        self.assertFalse(Group.objects.filter(project__isnull=True).exists())
        self.assertFalse(Event.objects.filter(project__isnull=True).exists())
        self.assertFalse(MessageFilterValue.objects.filter(project__isnull=True).exists())
        self.assertFalse(MessageCountByMinute.objects.filter(project__isnull=True).exists())
        self.assertFalse(FilterValue.objects.filter(project__isnull=True).exists())

        self.assertEquals(project2.group_set.count(), 4)
        self.assertEquals(project2.event_set.count(), 10)
        self.assertEquals(project2.messagefiltervalue_set.count(), 0)
        self.assertEquals(project2.messagecountbyminute_set.count(), 0)
        self.assertEquals(project2.filtervalue_set.count(), 0)


class ProjectMemberTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def test_get_dsn(self):
        member = ProjectMember(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com'):
            self.assertEquals(member.get_dsn(), 'http://public:secret@example.com/1')

    def test_get_dsn_with_ssl(self):
        member = ProjectMember(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='https://example.com'):
            self.assertEquals(member.get_dsn(), 'https://public:secret@example.com/1')

    def test_get_dsn_with_port(self):
        member = ProjectMember(project_id=1, public_key='public', secret_key='secret')
        with self.Settings(SENTRY_URL_PREFIX='http://example.com:81'):
            self.assertEquals(member.get_dsn(), 'http://public:secret@example.com:81/1')
