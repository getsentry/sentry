import pytest
from django.core.exceptions import SuspiciousFileOperation

from sentry.utils.samples import load_data


@pytest.mark.parametrize(
    "platform",
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
def test_path_traversal_attempt_raises_exception(platform):
    with pytest.raises(SuspiciousFileOperation):
        load_data(platform)


def test_missing_sample_raises_exception():
    platform = "random-platform-that-does-not-exist"

    with pytest.raises(FileNotFoundError):
        load_data(platform)


def test_sample_as_directory_raises_exception(monkeypatch, tmp_path):
    # override DATA_ROOT to a tmp directory
    monkeypatch.setattr("sentry.utils.samples.DATA_ROOT", tmp_path)

    # create a directory ending with `.json`
    samples_root = tmp_path / "samples" / "a_directory.json"
    samples_root.mkdir(parents=True)

    platform = "a_directory"
    with pytest.raises(IsADirectoryError):
        load_data(platform)
