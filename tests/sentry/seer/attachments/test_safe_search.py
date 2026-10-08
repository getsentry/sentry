from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings
from google.auth.credentials import AnonymousCredentials

from sentry.seer.attachments.models import AttachmentError
from sentry.seer.attachments.safe_search import scan_image
from sentry.testutils.helpers import override_options

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def vision_settings() -> Iterator[None]:
    with override_settings(
        SEER_ATTACHMENTS_VISION_PROJECT="test-project", SEER_ATTACHMENTS_VISION_LOCATION="us"
    ):
        yield


@pytest.fixture
def post() -> Iterator[MagicMock]:
    with (
        patch(
            "sentry.seer.attachments.safe_search.google.auth.default",
            return_value=(AnonymousCredentials(), None),
        ),
        patch("sentry.seer.attachments.safe_search.AuthorizedSession.post") as post,
    ):
        post.return_value = response()
        yield post


def response(annotation: dict[str, str] | None = None, status: int = 200) -> MagicMock:
    result = MagicMock(status_code=status)
    result.__enter__.return_value = result
    result.json.return_value = {
        "responses": [
            {
                "safeSearchAnnotation": annotation
                or {"adult": "VERY_UNLIKELY", "violence": "UNLIKELY", "racy": "POSSIBLE"}
            }
        ]
    }
    return result


@pytest.mark.parametrize("category", ["adult", "violence", "racy"])
@pytest.mark.parametrize("rating", ["LIKELY", "VERY_LIKELY"])
def test_blocking_ratings(post: MagicMock, category: str, rating: str) -> None:
    annotation = {"adult": "UNLIKELY", "violence": "UNLIKELY", "racy": "UNLIKELY", category: rating}
    post.return_value = response(annotation)
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.code == "image_rejected"
    assert post.call_count == 1


@pytest.mark.parametrize("rating", ["VERY_UNLIKELY", "UNLIKELY", "POSSIBLE"])
def test_acceptable_ratings_and_ignored_categories(post: MagicMock, rating: str) -> None:
    post.return_value = response(
        {
            "adult": rating,
            "violence": rating,
            "racy": rating,
            "medical": "VERY_LIKELY",
            "spoof": "VERY_LIKELY",
        }
    )
    scan_image(b"image")


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"responses": []},
        {"responses": [{"error": {"code": 13}}]},
        {"responses": [{"safeSearchAnnotation": {"adult": "UNLIKELY"}}]},
        {"responses": [{"safeSearchAnnotation": {"adult": "UNKNOWN"}}]},
        None,
    ],
)
def test_inconclusive_responses(post: MagicMock, payload: object) -> None:
    post.return_value.json.return_value = payload
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.status_code == 503
    assert exc.value.code == "scan_inconclusive"


@pytest.mark.parametrize("location", ["us", "eu"])
def test_regional_routing_and_timeout(post: MagicMock, location: str) -> None:
    with override_settings(SEER_ATTACHMENTS_VISION_LOCATION=location):
        scan_image(b"image")
    assert post.call_args.args == (
        f"https://{location}-vision.googleapis.com/v1/projects/test-project/locations/{location}/images:annotate",
    )
    assert post.call_args.kwargs == {
        "json": {
            "requests": [
                {"image": {"content": "aW1hZ2U="}, "features": [{"type": "SAFE_SEARCH_DETECTION"}]}
            ]
        },
        "timeout": 5.0,
        "allow_redirects": False,
    }


@pytest.mark.parametrize("location", ["", "global"])
def test_no_global_fallback(post: MagicMock, location: str) -> None:
    with override_settings(SEER_ATTACHMENTS_VISION_LOCATION=location):
        with pytest.raises(AttachmentError) as exc:
            scan_image(b"image")
    assert exc.value.status_code == 503
    post.assert_not_called()


@pytest.mark.parametrize(
    "failure",
    [requests.Timeout(), requests.ConnectionError(), response(status=429), response(status=503)],
)
def test_single_transient_retry(post: MagicMock, failure: Exception | MagicMock) -> None:
    post.side_effect = [failure, response()]
    scan_image(b"image")
    assert post.call_count == 2


@pytest.mark.parametrize("failure,attempts", [(requests.Timeout(), 2), (response(status=403), 1)])
def test_scan_failure_stops_retrying(
    post: MagicMock, failure: Exception | MagicMock, attempts: int
) -> None:
    post.side_effect = [failure, failure]
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.status_code == 503
    assert post.call_count == attempts


def test_threshold_option(post: MagicMock) -> None:
    with override_options({"seer.attachments.scan-racy-threshold": 3}):
        with pytest.raises(AttachmentError) as exc:
            scan_image(b"image")
    assert exc.value.code == "image_rejected"


def test_no_hidden_sdk_retries() -> None:
    with (
        patch(
            "sentry.seer.attachments.safe_search.google.auth.default",
            return_value=(AnonymousCredentials(), None),
        ),
        patch("sentry.seer.attachments.safe_search.AuthorizedSession") as session,
    ):
        session.return_value.__enter__.return_value.post.return_value = response()
        scan_image(b"image")
    assert session.call_args.kwargs["max_refresh_attempts"] == 0
    assert session.call_args.kwargs["refresh_timeout"] == 5.0
    auth_transport = session.call_args.kwargs["auth_request"].session
    assert auth_transport.adapters["https://"].max_retries.total == 0


@pytest.mark.parametrize("threshold", [0, 6])
def test_invalid_threshold_fails_closed(post: MagicMock, threshold: int) -> None:
    with (
        override_options({"seer.attachments.scan-adult-threshold": threshold}),
        pytest.raises(AttachmentError) as exc,
    ):
        scan_image(b"image")
    assert exc.value.status_code == 503
