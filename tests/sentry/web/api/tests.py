# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.compat import mock

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from exam import fixture
from six import BytesIO

from sentry.coreapi import APIRateLimited
from sentry.models import EventAttachment
from sentry.testutils import TestCase
from sentry.utils import json


class CrossDomainXmlTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-crossdomain-xml", kwargs={"project_id": self.project.id})

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_global(self, get_origins):
        get_origins.return_value = "*"
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        assert resp.status_code == 200, resp.content
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="*" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_whitelist(self, get_origins):
        get_origins.return_value = ["disqus.com", "www.disqus.com"]
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="disqus.com" secure="false" />' in resp.content
        assert b'<allow-access-from domain="www.disqus.com" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_no_origins(self, get_origins):
        get_origins.return_value = []
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b"<allow-access-from" not in resp.content

    def test_output_allows_x_sentry_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert (
            b'<allow-http-request-headers-from domain="*" headers="*" secure="false" />'
            in resp.content
        )


class EventAttachmentStoreViewTest(TestCase):
    @fixture
    def path(self):
        # TODO: Having the event set here means the case where event isnt' created
        # yet isn't covered by this test class
        return reverse(
            "sentry-api-event-attachment",
            kwargs={"project_id": self.project.id, "event_id": self.event.event_id},
        )

    def has_attachment(self):
        return EventAttachment.objects.filter(
            project_id=self.project.id, event_id=self.event.event_id
        ).exists()

    def test_event_attachments_feature_creates_attachment(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()

    def test_event_attachments_without_feature_returns_forbidden(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature({"organizations:event-attachments": False}):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 403
        assert not self.has_attachment()

    def test_event_attachments_without_files_returns_400(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader({}, format="multipart")

        assert response.status_code == 400
        assert not self.has_attachment()

    def test_event_attachments_event_doesnt_exist_creates_attachment(self):
        with self.feature("organizations:event-attachments"):
            self.path = self.path.replace(self.event.event_id, "z" * 32)
            out = BytesIO()
            out.write(b"hi")
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()

    def test_event_attachments_event_empty_file_creates_attachment(self):
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", BytesIO().getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()


class RobotsTxtTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-robots-txt")

    def test_robots(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "text/plain"


def rate_limited_dispatch(*args, **kwargs):
    raise APIRateLimited(retry_after=42.42)


class ClientConfigViewTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-client-config")

    def test_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None

    def test_authenticated(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email

    def test_superuser(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user, superuser=True)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email
        assert data["user"]["isSuperuser"]
