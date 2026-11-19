from io import BytesIO
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.issues.endpoints.group_comment_attachments import (
    COMMENT_ATTACHMENT_FILE_TYPE,
    parse_range,
)
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupredirect import GroupRedirect
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

FEATURE = "organizations:issue-comment-attachments"
VIDEO_BYTES = b"0123456789abcdef"


def upload(
    name: str = "video_1.mp4", content: bytes = VIDEO_BYTES, content_type: str = "video/mp4"
) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type=content_type)


class GroupCommentAttachmentsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.group = self.create_group()

    def url(self, group: Group | None = None) -> str:
        group = group or self.group
        return (
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/comment-attachments/"
        )

    def post(self, file: SimpleUploadedFile | None = None, group: Group | None = None) -> Any:
        data = {"file": file if file is not None else upload()}
        return self.client.post(self.url(group), data, format="multipart")

    def test_upload_video(self) -> None:
        with self.feature(FEATURE):
            response = self.post()

        assert response.status_code == 201, response.content
        file = File.objects.get(id=int(response.data["id"]))
        assert file.type == COMMENT_ATTACHMENT_FILE_TYPE
        assert file.size == len(VIDEO_BYTES)
        assert file.headers["Content-Type"] == "video/mp4"
        assert file.getfile().read() == VIDEO_BYTES
        assert response.data == {
            "id": str(file.id),
            "name": "video_1.mp4",
            "size": len(VIDEO_BYTES),
            "contentType": "video/mp4",
            "url": f"{self.url()}{file.id}/",
        }

    def test_feature_disabled(self) -> None:
        response = self.post()

        assert response.status_code == 404
        assert not File.objects.filter(type=COMMENT_ATTACHMENT_FILE_TYPE).exists()

    def test_missing_file(self) -> None:
        with self.feature(FEATURE):
            response = self.client.post(self.url(), {}, format="multipart")

        assert response.status_code == 400
        assert response.data["detail"] == "Missing uploaded file"

    def test_rejects_non_video(self) -> None:
        with self.feature(FEATURE):
            response = self.post(upload("page.html", b"<script></script>", "text/html"))

        assert response.status_code == 400
        assert not File.objects.filter(type=COMMENT_ATTACHMENT_FILE_TYPE).exists()

    def test_accepts_content_type_with_parameters(self) -> None:
        with self.feature(FEATURE):
            response = self.post(upload("clip.webm", content_type="video/webm; codecs=vp9"))

        assert response.status_code == 201, response.content
        assert response.data["contentType"] == "video/webm"

    @override_options({"issues.comment-attachments.max-size": len(VIDEO_BYTES) - 1})
    def test_rejects_file_over_max_size(self) -> None:
        with self.feature(FEATURE):
            response = self.post()

        assert response.status_code == 413
        assert response.data["maxSize"] == len(VIDEO_BYTES) - 1
        assert not File.objects.filter(type=COMMENT_ATTACHMENT_FILE_TYPE).exists()

    @override_options({"issues.comment-attachments.max-size": len(VIDEO_BYTES)})
    def test_accepts_file_at_max_size(self) -> None:
        with self.feature(FEATURE):
            response = self.post()

        assert response.status_code == 201, response.content

    def test_strips_path_from_file_name(self) -> None:
        with self.feature(FEATURE):
            response = self.post(upload("../../etc/clip.mp4"))

        assert response.status_code == 201, response.content
        assert response.data["name"] == "clip.mp4"

    def test_upload_with_write_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:write"])
        with self.feature(FEATURE):
            response = self.client.post(
                self.url(),
                {"file": upload()},
                format="multipart",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 201, response.content

    def test_upload_with_read_only_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])
        with self.feature(FEATURE):
            response = self.client.post(
                self.url(),
                {"file": upload()},
                format="multipart",
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )

        assert response.status_code == 403
        assert not File.objects.filter(type=COMMENT_ATTACHMENT_FILE_TYPE).exists()

    def test_user_outside_organization(self) -> None:
        self.login_as(self.create_user())
        with self.feature(FEATURE):
            response = self.post()

        assert response.status_code == 403
        assert not File.objects.filter(type=COMMENT_ATTACHMENT_FILE_TYPE).exists()


class GroupCommentAttachmentDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.group = self.create_group()
        with self.feature(FEATURE):
            response = self.client.post(
                f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/comment-attachments/",
                {"file": upload()},
                format="multipart",
            )
        assert response.status_code == 201, response.content
        self.attachment_url = response.data["url"]

    def get(self, url: str | None = None, **headers: str) -> Any:
        with self.feature(FEATURE):
            return self.client.get(url or self.attachment_url, **headers)

    def test_streams_video_inline(self) -> None:
        response = self.get()

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == VIDEO_BYTES
        assert response["Content-Type"] == "video/mp4"
        assert response["Content-Length"] == str(len(VIDEO_BYTES))
        assert response["Content-Disposition"] == 'inline; filename="video_1.mp4"'
        assert response["Accept-Ranges"] == "bytes"
        assert response["X-Content-Type-Options"] == "nosniff"

    def test_byte_range(self) -> None:
        response = self.get(HTTP_RANGE="bytes=2-5")

        assert response.status_code == 206
        assert b"".join(response.streaming_content) == VIDEO_BYTES[2:6]
        assert response["Content-Range"] == f"bytes 2-5/{len(VIDEO_BYTES)}"
        assert response["Content-Length"] == "4"

    def test_open_ended_byte_range(self) -> None:
        response = self.get(HTTP_RANGE="bytes=10-")

        assert response.status_code == 206
        assert b"".join(response.streaming_content) == VIDEO_BYTES[10:]

    def test_suffix_byte_range(self) -> None:
        response = self.get(HTTP_RANGE="bytes=-3")

        assert response.status_code == 206
        assert b"".join(response.streaming_content) == VIDEO_BYTES[-3:]

    def test_unsatisfiable_range(self) -> None:
        response = self.get(HTTP_RANGE=f"bytes={len(VIDEO_BYTES)}-")

        assert response.status_code == 416
        assert response["Content-Range"] == f"bytes */{len(VIDEO_BYTES)}"

    def test_read_with_read_only_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])

        response = self.get(HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == VIDEO_BYTES

    def test_feature_disabled(self) -> None:
        response = self.client.get(self.attachment_url)

        assert response.status_code == 404

    def test_attachment_from_another_issue(self) -> None:
        other_group = self.create_group()
        url = self.attachment_url.replace(f"/issues/{self.group.id}/", f"/issues/{other_group.id}/")

        response = self.get(url)

        assert response.status_code == 404

    def test_attachment_from_an_issue_merged_into_this_one(self) -> None:
        primary = self.create_group()
        GroupRedirect.objects.create(
            organization_id=self.organization.id,
            group_id=primary.id,
            previous_group_id=self.group.id,
        )
        url = self.attachment_url.replace(f"/issues/{self.group.id}/", f"/issues/{primary.id}/")

        response = self.get(url)

        assert response.status_code == 200
        assert b"".join(response.streaming_content) == VIDEO_BYTES

    def test_attachment_after_two_merges(self) -> None:
        middle = self.create_group()
        final = self.create_group()
        GroupRedirect.objects.create(
            organization_id=self.organization.id,
            group_id=middle.id,
            previous_group_id=self.group.id,
        )
        GroupRedirect.objects.create(
            organization_id=self.organization.id,
            group_id=final.id,
            previous_group_id=middle.id,
        )
        url = self.attachment_url.replace(f"/issues/{self.group.id}/", f"/issues/{final.id}/")

        response = self.get(url)

        assert response.status_code == 200

    def test_file_that_is_not_a_comment_attachment(self) -> None:
        file = File.objects.create(
            name="release.js",
            type="release.file",
            headers={"Content-Type": "video/mp4", "Sentry-Group-Id": str(self.group.id)},
        )
        file.putfile(BytesIO(b"x"))
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/comment-attachments/{file.id}/"

        response = self.get(url)

        assert response.status_code == 404

    def test_invalid_attachment_id(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/comment-attachments/abc/"

        response = self.get(url)

        assert response.status_code == 404

    def test_user_outside_organization(self) -> None:
        self.login_as(self.create_user())

        response = self.get()

        assert response.status_code == 403


@pytest.mark.parametrize(
    ("header", "size", "expected"),
    [
        ("bytes=0-9", 10, (0, 9)),
        ("bytes=0-99", 10, (0, 9)),
        ("bytes=5-", 10, (5, 9)),
        ("bytes=-4", 10, (6, 9)),
        ("bytes=-40", 10, (0, 9)),
        ("bytes=10-", 10, None),
        ("bytes=5-2", 10, None),
        ("bytes=-0", 10, None),
        ("bytes=-", 10, None),
        ("bytes=0-1,4-5", 10, None),
        ("items=0-1", 10, None),
        ("bytes=0-", 0, None),
    ],
)
def test_parse_range(header: str, size: int, expected: tuple[int, int] | None) -> None:
    assert parse_range(header, size) == expected
