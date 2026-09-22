from unittest.mock import Mock, patch

import pytest
import requests
from django.test import override_settings
from google.auth.credentials import AnonymousCredentials

from sentry.seer.attachments.models import AttachmentError
from sentry.seer.attachments.safe_search import scan_image
from sentry.testutils.helpers import override_options

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def vision_settings():
    with override_settings(
        SEER_ATTACHMENTS_VISION_PROJECT="test-project", SEER_ATTACHMENTS_VISION_LOCATION="us"
    ):
        yield


@pytest.fixture
def post():
    with (
        patch(
            "sentry.seer.attachments.safe_search.google.auth.default",
            return_value=(AnonymousCredentials(), None),
        ),
        patch("sentry.seer.attachments.safe_search.AuthorizedSession.post") as post,
    ):
        post.return_value = response()
        yield post


def response(annotation=None, status=200):
    result = Mock(status_code=status)
    result.__enter__ = Mock(return_value=result)
    result.__exit__ = Mock(return_value=False)
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
def test_blocking_ratings(post, category, rating):
    annotation = {"adult": "UNLIKELY", "violence": "UNLIKELY", "racy": "UNLIKELY", category: rating}
    post.return_value = response(annotation)
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.code == "image_rejected"
    assert post.call_count == 1


@pytest.mark.parametrize("rating", ["VERY_UNLIKELY", "UNLIKELY", "POSSIBLE"])
def test_acceptable_ratings_and_ignored_categories(post, rating):
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


@pytest.mark.parametrize("rating", ["UNKNOWN", "new-value", None, 0, {}])
def test_unknown_rating_fails_closed(post, rating):
    post.return_value = response({"adult": rating, "violence": "UNLIKELY", "racy": "UNLIKELY"})
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.code == "scan_inconclusive"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"responses": []},
        {"responses": [{"error": {"code": 13}}]},
        {"responses": [{"safeSearchAnnotation": {"adult": "UNLIKELY"}}]},
        None,
    ],
)
def test_inconclusive_responses(post, payload):
    post.return_value.json.return_value = payload
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.status_code == 503


@pytest.mark.parametrize("location", ["us", "eu"])
def test_regional_routing_and_timeout(post, location):
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


@pytest.mark.parametrize("location", ["", "global", "asia"])
def test_no_global_fallback(post, location):
    with override_settings(SEER_ATTACHMENTS_VISION_LOCATION=location):
        with pytest.raises(AttachmentError) as exc:
            scan_image(b"image")
    assert exc.value.status_code == 503
    post.assert_not_called()


@pytest.mark.parametrize(
    "failure",
    [requests.Timeout(), requests.ConnectionError(), response(status=429), response(status=503)],
)
def test_single_transient_retry(post, failure):
    post.side_effect = [failure, response()]
    scan_image(b"image")
    assert post.call_count == 2


def test_timeout_exhausted(post):
    post.side_effect = requests.Timeout()
    with pytest.raises(AttachmentError) as exc:
        scan_image(b"image")
    assert exc.value.status_code == 503
    assert post.call_count == 2


def test_permanent_error_does_not_retry(post):
    post.return_value = response(status=403)
    with pytest.raises(AttachmentError):
        scan_image(b"image")
    assert post.call_count == 1


def test_threshold_option(post):
    with override_options({"seer.attachments.scan-racy-threshold": 3}):
        with pytest.raises(AttachmentError) as exc:
            scan_image(b"image")
    assert exc.value.code == "image_rejected"


def test_no_hidden_sdk_retries():
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
def test_invalid_threshold_fails_closed(post, threshold):
    with (
        override_options({"seer.attachments.scan-adult-threshold": threshold}),
        pytest.raises(AttachmentError) as exc,
    ):
        scan_image(b"image")
    assert exc.value.status_code == 503
