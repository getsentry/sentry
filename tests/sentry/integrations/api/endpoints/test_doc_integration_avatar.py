from __future__ import annotations

from base64 import b64encode
from typing import Any

from django.test import override_settings
from rest_framework import status

from sentry import options as options_store
from sentry.api.serializers.base import serialize
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class DocIntegrationAvatarTest(APITestCase):
    endpoint = "sentry-api-0-doc-integration-avatar"

    def setUp(self):
        self.user = self.create_user(email="peter@marvel.com", is_superuser=True)
        self.superuser = self.create_user(email="gwen@marvel.com", is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.draft_doc = self.create_doc_integration(
            name="spiderman", is_draft=True, has_avatar=True
        )
        self.published_doc = self.create_doc_integration(
            name="spiderwoman", is_draft=False, has_avatar=True
        )
        self.avatar_payload = {
            "avatar_photo": b64encode(self.load_fixture("rookout-color.png")),
            "avatar_type": "upload",
        }


@control_silo_test
class GetDocIntegrationAvatarTest(DocIntegrationAvatarTest):
    method = "GET"

    def test_user_view_avatar(self):
        """
        Tests that regular users can see only published doc integration avatars
        """
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.published_doc.slug, status_code=status.HTTP_200_OK
        )
        assert serialize(self.published_doc) == response.data
        assert serialize(self.published_doc.avatar.get()) == response.data["avatar"]
        response = self.get_error_response(
            self.draft_doc.slug, status_code=status.HTTP_403_FORBIDDEN
        )

    # TODO(schew2381): Change test to check that superusers can only see published doc integration avatars
    def test_superuser_view_avatar(self):
        """
        Tests that superusers can see all doc integration avatars
        """
        self.login_as(user=self.superuser, superuser=True)
        for doc in [self.published_doc, self.draft_doc]:
            response = self.get_success_response(doc.slug, status_code=status.HTTP_200_OK)
            assert serialize(doc) == response.data
            assert serialize(doc.avatar.get()) == response.data["avatar"]

    def test_staff_view_avatar(self):
        """
        Tests that staff can see all doc integration avatars
        """
        self.login_as(user=self.staff_user, staff=True)
        for doc in [self.published_doc, self.draft_doc]:
            response = self.get_success_response(doc.slug, status_code=status.HTTP_200_OK)
            assert serialize(doc) == response.data
            assert serialize(doc.avatar.get()) == response.data["avatar"]


@control_silo_test
class PutDocIntegrationAvatarTest(DocIntegrationAvatarTest):
    method = "PUT"

    def test_user_upload_avatar(self):
        """
        Tests that regular users cannot upload doc integration avatars
        """
        self.login_as(user=self.user)
        self.get_error_response(self.published_doc.slug, status_code=status.HTTP_403_FORBIDDEN)
        self.get_error_response(self.draft_doc.slug, status_code=status.HTTP_403_FORBIDDEN)

    # TODO(schew2381): Change test to check that superusers cannot upload doc integration avatars
    def test_superuser_upload_avatar(self):
        """
        Tests that superusers can upload avatars
        """
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            self.login_as(user=self.superuser, superuser=True)

            with (
                assume_test_silo_mode(SiloMode.CONTROL),
                override_settings(SILO_MODE=SiloMode.CONTROL),
            ):
                for doc in [self.published_doc, self.draft_doc]:
                    prev_avatar = doc.avatar.get()
                    response = self.get_success_response(
                        doc.slug, status_code=status.HTTP_200_OK, **self.avatar_payload
                    )
                    assert serialize(doc) == response.data
                    assert serialize(doc.avatar.get()) == response.data["avatar"]
                    assert serialize(prev_avatar) != response.data["avatar"]
                    assert prev_avatar.control_file_id != doc.avatar.get().control_file_id

    def test_staff_upload_avatar(self):
        """
        Tests that superusers can upload avatars
        """
        with self.options(
            {
                "filestore.control.backend": options_store.get("filestore.backend"),
                "filestore.control.options": options_store.get("filestore.options"),
            }
        ):
            self.login_as(user=self.staff_user, staff=True)

            with (
                assume_test_silo_mode(SiloMode.CONTROL),
                override_settings(SILO_MODE=SiloMode.CONTROL),
            ):
                for doc in [self.published_doc, self.draft_doc]:
                    prev_avatar = doc.avatar.get()
                    response = self.get_success_response(
                        doc.slug, status_code=status.HTTP_200_OK, **self.avatar_payload
                    )
                    assert serialize(doc) == response.data
                    assert serialize(doc.avatar.get()) == response.data["avatar"]
                    assert serialize(prev_avatar) != response.data["avatar"]
                    assert prev_avatar.control_file_id != doc.avatar.get().control_file_id

    def test_upload_avatar_payload_structure(self):
        """
        Tests that errors are thrown on malformed upload payloads
        """
        self.login_as(user=self.staff_user, staff=True)
        # Structured as 'error-description' : (malformed-payload, erroring-fields)
        invalid_payloads: dict[str, tuple[dict[str, Any], list[str]]] = {
            "empty_payload": ({}, ["avatar_photo", "avatar_type"]),
            "missing_avatar_photo": (
                {"avatar_type": self.avatar_payload["avatar_type"]},
                ["avatar_photo"],
            ),
            "missing_avatar_type": (
                {"avatar_photo": self.avatar_payload["avatar_photo"]},
                ["avatar_type"],
            ),
            "invalid_avatar_type": ({**self.avatar_payload, "avatar_type": 1}, ["avatar_type"]),
        }
        for payload, fields in invalid_payloads.values():
            response = self.get_error_response(
                self.draft_doc.slug, status_code=status.HTTP_400_BAD_REQUEST, **payload
            )
            for field in fields:
                assert field in response.data.keys()
