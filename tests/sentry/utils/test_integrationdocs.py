import pytest

from sentry.utils.integrationdocs import dump_doc, load_doc


@pytest.mark.parametrize(
    "path",
    [
        ("/"),
        ("/.."),
        ("//...."),
        ("/%5c.."),
        ("../"),
        ("../../"),
        ("../../../etc/passwd"),
    ],
)
def test_path_traversal_attempt_on_load_doc_raises_exception(path):
    with pytest.raises(Exception):
        load_doc(path)


@pytest.mark.parametrize(
    "path",
    [
        ("/"),
        ("/.."),
        ("//...."),
        ("/%5c.."),
        ("../"),
        ("../../"),
        ("../../../etc/passwd"),
    ],
)
def test_path_traversal_attempt_on_dump_doc_raises_exception(path):
    data = {"foo": "bar", "baz": 1234}

    with pytest.raises(Exception):
        dump_doc(path, data)
