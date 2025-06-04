import pytest

from sentry.utils.integrationdocs import SuspiciousDocPathOperation, load_doc


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
