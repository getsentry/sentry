from __future__ import absolute_import

from sentry.utils.validators import is_event_id, normalize_event_id


def test_is_event_id():
    assert is_event_id("b802415f7531431caa27f5c0bf923302")
    assert is_event_id("B802415F7531431CAA27F5C0BF923302")
    assert is_event_id("b802415f-7531-431c-aa27-f5c0bf923302")
    assert is_event_id("B802415F-7531-431C-AA27-F5C0BF923302")
    assert is_event_id(b"b802415f7531431caa27f5c0bf923302")

    assert not is_event_id("")
    assert not is_event_id("b802415f7531431caa")
    assert not is_event_id("XXXX415f7531431caa27f5c0bf92XXXX")
    assert not is_event_id(4711)
    assert not is_event_id(False)
    assert not is_event_id(None)


def test_normalize_event_id():
    assert (
        normalize_event_id("b802415f7531431caa27f5c0bf923302") == "b802415f7531431caa27f5c0bf923302"
    )
    assert (
        normalize_event_id("B802415F7531431CAA27F5C0BF923302") == "b802415f7531431caa27f5c0bf923302"
    )
    assert (
        normalize_event_id("b802415f-7531-431c-aa27-f5c0bf923302")
        == "b802415f7531431caa27f5c0bf923302"
    )
    assert (
        normalize_event_id("B802415F-7531-431C-AA27-F5C0BF923302")
        == "b802415f7531431caa27f5c0bf923302"
    )
    assert (
        normalize_event_id(b"b802415f7531431caa27f5c0bf923302")
        == "b802415f7531431caa27f5c0bf923302"
    )

    assert normalize_event_id("") is None
    assert normalize_event_id("b802415f7531431caa") is None
    assert normalize_event_id("XXXX415f7531431caa27f5c0bf92XXXX") is None
    assert normalize_event_id(4711) is None
    assert normalize_event_id(False) is None
    assert normalize_event_id(None) is None
