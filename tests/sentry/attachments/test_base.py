from sentry.attachments import CachedAttachment


def test_meta_basic() -> None:
    att = CachedAttachment(name="lol.txt", content_type="text/plain")

    # Regression test to verify that we do not add additional attributes. Note
    # that ``rate_limited`` is missing from this dict.
    assert att.meta() == {
        "content_type": "text/plain",
        "name": "lol.txt",
        "size": 0,
        "type": "event.attachment",
    }


def test_meta_rate_limited() -> None:
    att = CachedAttachment(name="lol.txt", content_type="text/plain", rate_limited=True)

    assert att.meta() == {
        "content_type": "text/plain",
        "name": "lol.txt",
        "rate_limited": True,
        "size": 0,
        "type": "event.attachment",
    }
