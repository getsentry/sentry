import pytest

from sentry.utils.integrationdocs import SuspiciousDocPathOperation, dump_doc, load_doc


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/..",
        "//....",
        "/%5c..",
        "../",
        "../../",
        "../../../etc/passwd",
    ],
)
def test_path_traversal_attempt_on_load_doc_raises_exception(path):
    with pytest.raises(SuspiciousDocPathOperation) as excinfo:
        load_doc(path)

    (msg,) = excinfo.value.args
    assert msg == "illegal path access"


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/..",
        "//....",
        "/%5c..",
        "../",
        "../../",
        "../../../etc/passwd",
    ],
)
def test_path_traversal_attempt_on_dump_doc_raises_exception(path):
    data = {"foo": "bar", "baz": 1234}

    with pytest.raises(SuspiciousDocPathOperation) as excinfo:
        dump_doc(path, data)

    (msg,) = excinfo.value.args
    assert msg == "illegal path access"
