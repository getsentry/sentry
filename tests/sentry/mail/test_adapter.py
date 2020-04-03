from __future__ import absolute_import

from django.core import mail
from exam import fixture

from sentry.models import (
    OrganizationMember,
    OrganizationMemberTeam,
    ProjectOption,
    ProjectOwnership,
    User,
    UserOption,
)
from sentry.event_manager import EventManager, get_event_type
from sentry.mail.adapter import MailAdapter
from sentry.ownership.grammar import dump_schema, Matcher, Owner, Rule
from sentry.testutils import TestCase


class BaseMailAdapterTest(object):
    @fixture
    def adapter(self):
        return MailAdapter()


class MailAdapterGetSendToTest(BaseMailAdapterTest, TestCase):
    def setUp(self):
        self.user = self.create_user(email="foo@example.com", is_active=True)
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)

        self.project = self.create_project(name="Test", teams=[self.team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user=self.user, organization=self.organization
            ),
            team=self.team,
        )
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team])
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)]),
                    Rule(Matcher("path", "*.jx"), [Owner("user", self.user2.email)]),
                    Rule(
                        Matcher("path", "*.cbl"),
                        [Owner("user", self.user.email), Owner("user", self.user2.email)],
                    ),
                ]
            ),
            fallthrough=True,
        )

    def make_event_data(self, filename, url="http://example.com"):
        mgr = EventManager(
            {
                "tags": [("level", "error")],
                "stacktrace": {"frames": [{"lineno": 1, "filename": filename}]},
                "request": {"url": url},
            }
        )
        mgr.normalize()
        data = mgr.get_data()
        event_type = get_event_type(data)
        data["type"] = event_type.key
        data["metadata"] = event_type.get_metadata(data)
        return data

    def test_get_send_to_with_team_owners(self):
        event = self.store_event(data=self.make_event_data("foo.py"), project_id=self.project.id)
        assert sorted(set([self.user.pk, self.user2.pk])) == sorted(
            self.adapter.get_send_to(self.project, event.data)
        )

        # Make sure that disabling mail alerts works as expected
        UserOption.objects.set_value(
            user=self.user2, key="mail:alert", value=0, project=self.project
        )
        assert set([self.user.pk]) == self.adapter.get_send_to(self.project, event.data)

    def test_get_send_to_with_user_owners(self):
        event = self.store_event(data=self.make_event_data("foo.cbl"), project_id=self.project.id)
        assert sorted(set([self.user.pk, self.user2.pk])) == sorted(
            self.adapter.get_send_to(self.project, event.data)
        )

        # Make sure that disabling mail alerts works as expected
        UserOption.objects.set_value(
            user=self.user2, key="mail:alert", value=0, project=self.project
        )
        assert set([self.user.pk]) == self.adapter.get_send_to(self.project, event.data)

    def test_get_send_to_with_user_owner(self):
        event = self.store_event(data=self.make_event_data("foo.jx"), project_id=self.project.id)
        assert set([self.user2.pk]) == self.adapter.get_send_to(self.project, event.data)

    def test_get_send_to_with_fallthrough(self):
        event = self.store_event(data=self.make_event_data("foo.cpp"), project_id=self.project.id)
        assert set([self.user.pk, self.user2.pk]) == set(
            self.adapter.get_send_to(self.project, event.data)
        )

    def test_get_send_to_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = self.store_event(data=self.make_event_data("foo.cpp"), project_id=self.project.id)
        assert [] == self.adapter.get_send_to(self.project, event.data)


class MailAdapterGetSendableUsersTest(BaseMailAdapterTest, TestCase):
    def test_get_sendable_users(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_user(email="baz2@example.com", is_active=True)

        # user with inactive account
        self.create_user(email="bar@example.com", is_active=False)
        # user not in any groups
        self.create_user(email="bar2@example.com", is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        project = self.create_project(name="Test", teams=[team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(user=user, organization=organization),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])

        # all members
        assert sorted(set([user.pk, user2.pk])) == sorted(self.adapter.get_sendable_users(project))

        # disabled user2
        UserOption.objects.create(key="mail:alert", value=0, project=project, user=user2)

        assert user2.pk not in self.adapter.get_sendable_users(project)

        user4 = User.objects.create(username="baz4", email="bar@example.com", is_active=True)
        self.create_member(user=user4, organization=organization, teams=[team])
        assert user4.pk in self.adapter.get_sendable_users(project)

        # disabled by default user4
        uo1 = UserOption.objects.create(
            key="subscribe_by_default", value="0", project=project, user=user4
        )

        assert user4.pk not in self.adapter.get_sendable_users(project)

        uo1.delete()

        UserOption.objects.create(
            key="subscribe_by_default", value=u"0", project=project, user=user4
        )

        assert user4.pk not in self.adapter.get_sendable_users(project)


class MailAdapterBuildSubjectPrefixTest(BaseMailAdapterTest, TestCase):
    def test_default_prefix(self):
        assert self.adapter._build_subject_prefix(self.project) == "[Sentry] "

    def test_project_level_prefix(self):
        prefix = "[Example prefix] "
        ProjectOption.objects.set_value(
            project=self.project, key=u"mail:subject_prefix", value=prefix
        )
        assert self.adapter._build_subject_prefix(self.project) == prefix


class MailAdapterBuildMessageTest(BaseMailAdapterTest, TestCase):
    def test(self):
        subject = "hello"
        msg = self.adapter._build_message(self.project, subject)
        assert msg._send_to == set([self.user.email])
        assert msg.subject.endswith(subject)

    def test_specify_send_to(self):
        subject = "hello"
        send_to_user = self.create_user("hello@timecube.com")
        msg = self.adapter._build_message(self.project, subject, send_to=[send_to_user.id])
        assert msg._send_to == set([send_to_user.email])
        assert msg.subject.endswith(subject)


class MailAdapterSendMailTest(BaseMailAdapterTest, TestCase):
    def test(self):
        subject = "hello"
        with self.tasks():
            self.adapter._send_mail(self.project, subject, body="hi")
            msg = mail.outbox[0]
            assert msg.subject.endswith(subject)
            assert msg.recipients() == [self.user.email]
