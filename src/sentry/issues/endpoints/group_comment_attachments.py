from __future__ import annotations

import posixpath
import re
from collections.abc import Iterator

from django.http import HttpResponse, StreamingHttpResponse
from django.utils.http import content_disposition_header
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupredirect import GroupRedirect

COMMENT_ATTACHMENT_FILE_TYPE = "issue.comment.attachment"
FEATURE_NAME = "organizations:issue-comment-attachments"

# Only video formats browsers can play inline are accepted. The content type
# the client sends is checked against this list and served back as-is, so
# nothing else (HTML, SVG, ...) can be uploaded and rendered from our origin.
ALLOWED_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/ogg",
    }
)

# The file row has no foreign key to the issue, so the issue it was uploaded to
# is kept in the file headers and checked on every read. Merging moves comments
# to the surviving issue, so issues merged into it are accepted too.
GROUP_ID_HEADER = "Sentry-Group-Id"

# How many merges in a row to follow from the issue a file was uploaded to.
MAX_MERGE_HOPS = 10

STREAM_CHUNK_SIZE = 64 * 1024
RANGE_PATTERN = re.compile(r"^bytes=(\d*)-(\d*)$")


def attachment_url(group: Group, file: File) -> str:
    return (
        f"/api/0/organizations/{group.organization.slug}/issues/{group.id}"
        f"/comment-attachments/{file.id}/"
    )


def serialize_attachment(group: Group, file: File) -> dict[str, object]:
    return {
        "id": str(file.id),
        "name": file.name,
        "size": file.size,
        "contentType": file.headers.get("Content-Type"),
        "url": attachment_url(group, file),
    }


def parse_range(header: str, size: int) -> tuple[int, int] | None:
    """
    Parses a single `bytes=start-end` range into inclusive offsets. Returns
    None when the range cannot be satisfied for a file of `size` bytes.
    """
    match = RANGE_PATTERN.match(header.strip())
    if not match or size == 0:
        return None
    start_str, end_str = match.groups()
    if not start_str and not end_str:
        return None
    try:
        if not start_str:
            # Suffix range: the last N bytes.
            length = int(end_str)
            if length == 0:
                return None
            return max(size - length, 0), size - 1
        start = int(start_str)
        end = int(end_str) if end_str else size - 1
    except ValueError:
        # More digits than int() converts: no file is that large anyway.
        return None
    if start >= size or end < start:
        return None
    return start, min(end, size - 1)


def belongs_to_group(file: File, group: Group) -> bool:
    """
    True when the file was uploaded to this issue, or to an issue that was
    later merged into it.
    """
    uploaded_to = file.headers.get(GROUP_ID_HEADER)
    if not uploaded_to or not uploaded_to.isdecimal():
        return False
    # An issue is merged away at most once, so its redirects form a chain.
    # Old redirects are not repointed when the target is merged again.
    group_id = int(uploaded_to)
    for _ in range(MAX_MERGE_HOPS + 1):
        if group_id == group.id:
            return True
        redirect = GroupRedirect.objects.get_or_none(previous_group_id=group_id)
        if redirect is None:
            return False
        group_id = redirect.group_id
    return False


@cell_silo_endpoint
class GroupCommentAttachmentsEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, group: Group) -> Response:
        """
        Upload a video to reference from an issue comment. The response holds
        the URL the comment text links to.
        """
        if not features.has(FEATURE_NAME, group.organization, actor=request.user):
            return Response(status=404)

        fileobj = request.data.get("file")
        if fileobj is None or not hasattr(fileobj, "read"):
            return Response({"detail": "Missing uploaded file"}, status=400)

        content_type = (fileobj.content_type or "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            return Response(
                {"detail": "Only MP4, MOV, WebM and Ogg videos can be attached."},
                status=400,
            )

        max_size = options.get("issues.comment-attachments.max-size")
        if fileobj.size > max_size:
            return Response(
                {
                    "detail": f"File is too large. The maximum size is {max_size // (1024 * 1024)} MB.",
                    "maxSize": max_size,
                },
                status=413,
            )

        name = posixpath.basename(" ".join((fileobj.name or "video").split())) or "video"
        file = File.objects.create(
            name=name,
            type=COMMENT_ATTACHMENT_FILE_TYPE,
            headers={"Content-Type": content_type, GROUP_ID_HEADER: str(group.id)},
        )
        file.putfile(fileobj)

        return Response(serialize_attachment(group, file), status=201)


@cell_silo_endpoint
class GroupCommentAttachmentDetailsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, group: Group, attachment_id: str
    ) -> Response | HttpResponse | StreamingHttpResponse:
        """
        Stream an issue comment video inline. Single byte ranges are supported
        so browsers can seek (Safari will not play video without them).
        """
        if not features.has(FEATURE_NAME, group.organization, actor=request.user):
            return Response(status=404)

        try:
            file = File.objects.get(id=int(attachment_id), type=COMMENT_ATTACHMENT_FILE_TYPE)
        except (ValueError, File.DoesNotExist):
            return Response(status=404)
        if not belongs_to_group(file, group):
            return Response(status=404)

        size = file.size or 0
        start, end = 0, size - 1
        status = 200
        range_header = request.META.get("HTTP_RANGE")
        if range_header:
            byte_range = parse_range(range_header, size)
            if byte_range is None:
                unsatisfiable = HttpResponse(status=416)
                unsatisfiable["Content-Range"] = f"bytes */{size}"
                return unsatisfiable
            start, end = byte_range
            status = 206

        def stream() -> Iterator[bytes]:
            remaining = end - start + 1
            with file.getfile() as fp:
                fp.seek(start)
                while remaining > 0:
                    chunk = fp.read(min(STREAM_CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = StreamingHttpResponse(
            stream() if size else iter(()),
            status=status,
            content_type=file.headers.get("Content-Type", "application/octet-stream"),
        )
        response["Content-Length"] = str(end - start + 1 if size else 0)
        response["Accept-Ranges"] = "bytes"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Disposition"] = content_disposition_header(False, file.name) or "inline"
        if status == 206:
            response["Content-Range"] = f"bytes {start}-{end}/{size}"
        return response
