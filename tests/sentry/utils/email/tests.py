from __future__ import absolute_import

import functools

import pytest
from django.core import mail
from sentry.utils.compat.mock import patch

from sentry import options
from sentry.models import GroupEmailThread, User, UserOption
from sentry.testutils import TestCase
from sentry.utils.email import (
    ListResolver,
    MessageBuilder,
    default_list_type_handlers,
    get_from_email_domain,
    get_mail_backend,
    create_fake_email,
    send_mail,
)


class ListResolverTestCase(TestCase):
    resolver = ListResolver("namespace", default_list_type_handlers)

    def test_rejects_invalid_namespace(self):
        with pytest.raises(AssertionError):
            ListResolver("\x00", {})

    def test_rejects_invalid_types(self):
        with pytest.raises(ListResolver.UnregisteredTypeError):
            self.resolver(object())

    def test_generates_list_ids(self):
        expected = u"<{0.project.slug}.{0.organization.slug}.namespace>".format(self.event)
        assert self.resolver(self.event.group) == expected
        assert self.resolver(self.event.project) == expected

    def test_rejects_invalid_objects(self):
        resolver = ListResolver("namespace", {object: lambda value: ("\x00",)})

        with pytest.raises(AssertionError):
            resolver(object())


class MessageBuilderTest(TestCase):
    def test_raw_content(self):
        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<b>hello world</b>",
            headers={"X-Test": "foo"},
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Test"
        assert out.extra_headers["X-Test"] == "foo"
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

    def test_inline_css(self):
        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<head><style type='text/css'>h1 { color: red; }</style></head><h1>foobar</h1><h2><b>hello world</b></h2>",
            headers={"X-Test": "foo"},
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Test"
        assert out.extra_headers["X-Test"] == "foo"
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<!DOCTYPE html>\n<html><head></head><body><h1 style="color: red">foobar</h1><h2><b>hello world</b></h2></body></html>',
            "text/html",
        )

    def test_explicit_reply_to(self):
        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<b>hello world</b>",
            headers={"X-Sentry-Reply-To": "bar@example.com"},
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Test"
        assert out.extra_headers["Reply-To"] == "bar@example.com"
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

    def test_with_users(self):
        project = self.project

        user_a = User.objects.create(email="foo@example.com")
        user_b = User.objects.create(email="bar@example.com")
        user_c = User.objects.create(email="baz@example.com")

        UserOption.objects.create(
            user=user_c, project=project, key="mail:email", value="bazzer@example.com"
        )

        msg = MessageBuilder(
            subject="Test", body="hello world", html_body="<!DOCTYPE html>\n<b>hello world</b>"
        )
        msg.add_users([user_a.id, user_b.id, user_c.id], project=project)
        msg.send()

        assert len(mail.outbox) == 3

        assert sorted([out.to[0] for out in mail.outbox]) == [
            "bar@example.com",
            "bazzer@example.com",
            "foo@example.com",
        ]

    def test_fake_dont_send(self):
        project = self.project

        user_a = User.objects.create(email=create_fake_email("foo", "fake"))
        user_b = User.objects.create(email=create_fake_email("bar", "fake"))
        user_c = User.objects.create(email=create_fake_email("baz", "fake"))

        UserOption.objects.create(
            user=user_c,
            project=project,
            key="mail:email",
            value=create_fake_email("bazzer", "fake"),
        )

        msg = MessageBuilder(
            subject="Test", body="hello world", html_body="<!DOCTYPE html>\n<b>hello world</b>"
        )
        msg.add_users([user_a.id, user_b.id, user_c.id], project=project)
        msg.send()

        assert len(mail.outbox) == 0

    @patch("sentry.utils.email.make_msgid")
    def test_message_id(self, make_msgid):
        make_msgid.return_value = "abc123"

        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<b>hello world</b>",
            reference=self.activity,
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Test"
        assert out.extra_headers["Message-Id"] == "abc123"
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

    @patch("sentry.utils.email.make_msgid")
    def test_add_groupemailthread(self, make_msgid):
        make_msgid.return_value = "abc123"

        msg = MessageBuilder(
            subject="Test", body="hello world", html_body="<b>hello world</b>", reference=self.group
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Test", "First message should not have Re: prefix"
        assert out.extra_headers["Message-Id"] == "abc123"
        assert "In-Reply-To" not in out.extra_headers
        assert "References" not in out.extra_headers
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

        # Our new EmailThread row was added
        assert GroupEmailThread.objects.count() == 1
        thread = GroupEmailThread.objects.all()[0]
        assert thread.msgid == "abc123"
        assert thread.email == "foo@example.com"
        assert thread.group == self.group

    @patch("sentry.utils.email.make_msgid")
    def test_reply_reference(self, make_msgid):
        make_msgid.return_value = "abc123"

        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<b>hello world</b>",
            reference=self.activity,
            reply_reference=self.group,
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Re: Test"
        assert out.extra_headers["Message-Id"] == "abc123"
        assert "In-Reply-To" not in out.extra_headers
        assert "References" not in out.extra_headers
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

        # Our new EmailThread row was added
        assert GroupEmailThread.objects.count() == 1
        thread = GroupEmailThread.objects.all()[0]
        assert thread.msgid == "abc123"
        assert thread.email == "foo@example.com"
        assert thread.group == self.group

        # new msgid for the next message
        make_msgid.return_value = "321cba"
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 2

        out = mail.outbox[1]
        assert out.to == ["foo@example.com"]
        assert out.subject == "Re: Test"
        assert out.extra_headers["Message-Id"] == "321cba"
        assert out.extra_headers["In-Reply-To"] == "abc123"
        assert out.extra_headers["References"] == "abc123"
        assert out.body == "hello world"
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            "<!DOCTYPE html>\n<html><body><b>hello world</b></body></html>",
            "text/html",
        )

        # Our new GroupEmailThread row was added
        assert GroupEmailThread.objects.count() == 1, "Should not have added a new row"
        assert GroupEmailThread.objects.all()[0].msgid == "abc123", "msgid should not have changed"

    def test_get_built_messages(self):
        msg = MessageBuilder(
            subject="Test",
            body="hello world",
            html_body="<b>hello world</b>",
            reference=self.activity,
            reply_reference=self.group,
        )
        results = msg.get_built_messages(["foo@example.com"])
        assert len(results) == 1

    def test_bcc_on_send(self):
        msg = MessageBuilder(subject="Test", body="hello world")
        msg.send(["foo@example.com"], bcc=["bar@example.com"])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ["foo@example.com"]
        assert out.bcc == ["bar@example.com"]

    def test_generates_list_ids_for_registered_types(self):
        build_message = functools.partial(
            MessageBuilder, subject="Test", body="hello world", html_body="<b>hello world</b>"
        )

        expected = u"<{event.project.slug}.{event.organization.slug}.{namespace}>".format(
            event=self.event, namespace=options.get("mail.list-namespace")
        )

        references = (self.event.group, self.event.project, self.activity)

        for reference in references:
            (message,) = build_message(reference=reference).get_built_messages(["foo@example.com"])
            assert message.message()["List-Id"] == expected

    def test_does_not_generates_list_ids_for_unregistered_types(self):
        message = (
            MessageBuilder(
                subject="Test",
                body="hello world",
                html_body="<b>hello world</b>",
                reference=object(),
            )
            .get_built_messages(["foo@example.com"])[0]
            .message()
        )

        assert "List-Id" not in message

    def test_stripped_newline(self):
        msg = MessageBuilder(
            subject="Foo\r\nBar", body="hello world", html_body="<b>hello world</b"
        )
        msg.send(["foo@example.com"])

        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == "Foo"


class MiscTestCase(TestCase):
    def test_get_from_email_domain(self):
        with self.options({"mail.from": "matt@example.com"}):
            assert get_from_email_domain() == "example.com"

        with self.options({"mail.from": "root@localhost"}):
            assert get_from_email_domain() == "localhost"

        with self.options({"mail.from": "garbage"}):
            assert get_from_email_domain() == "garbage"

    def test_get_mail_backend(self):
        with self.options({"mail.backend": "smtp"}):
            assert get_mail_backend() == "django.core.mail.backends.smtp.EmailBackend"

        with self.options({"mail.backend": "dummy"}):
            assert get_mail_backend() == "django.core.mail.backends.dummy.EmailBackend"

        with self.options({"mail.backend": "console"}):
            assert get_mail_backend() == "django.core.mail.backends.console.EmailBackend"

        with self.options({"mail.backend": "something.else"}):
            assert get_mail_backend() == "something.else"


class SendMail(TestCase):
    @patch("django.core.mail.EmailMessage", autospec=True)
    @patch("django.core.mail.get_connection", return_value="connection")
    def test_send_mail_with_kwargs(self, get_connection, MockEmailMessage):
        patch.object(MockEmailMessage.return_value, "send")
        send_mail(
            "subject", "my_message", "fake@example.com", ["a@b.com"], reply_to=["emusk@tesla.com"]
        )
        MockEmailMessage.assert_called_once_with(
            "subject",
            "my_message",
            "fake@example.com",
            ["a@b.com"],
            connection="connection",
            reply_to=["emusk@tesla.com"],
        )
        MockEmailMessage.return_value.send.assert_called_once_with(fail_silently=False)
