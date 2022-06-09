import os
from unittest import mock

import pytest

from tools import docker_memory_check


@pytest.mark.parametrize(
    ("option", "expected"),
    (
        ("always", True),
        ("never", False),
    ),
)
def test_should_use_color_forced(option, expected):
    assert docker_memory_check.should_use_color(option) is expected


def test_should_use_color_determined_by_CI_variable_missing():
    with mock.patch.dict(os.environ, clear=True):
        assert docker_memory_check.should_use_color("auto") is True


def test_should_use_color_determined_by_CI_variable_empty():
    with mock.patch.dict(os.environ, {"CI": ""}):
        assert docker_memory_check.should_use_color("auto") is True


def test_should_use_color_determined_by_CI_variable_present():
    with mock.patch.dict(os.environ, {"CI": ""}):
        assert docker_memory_check.should_use_color("1") is False


def test_color_using_color():
    ret = docker_memory_check.color("hello hello", "\033[33m", use_color=True)
    assert ret == "\033[33mhello hello\033[m"


def test_color_not_using_color():
    ret = docker_memory_check.color("hello hello", "\033[33m", use_color=False)
    assert ret == "hello hello"


def test_check_ignored_file_does_not_exist(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")

    assert docker_memory_check.main(("--settings-file", str(json_file))) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_check_ignored_file_is_not_json(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")
    json_file.write_text("not json")

    assert docker_memory_check.main(("--settings-file", str(json_file))) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_check_ignored_file_missing_field(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")
    json_file.write_text("{}")

    assert docker_memory_check.main(("--settings-file", str(json_file))) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_check_ignored_memory_limit_not_int(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")
    json_file.write_text('{"memoryMiB": "lots"}')

    assert docker_memory_check.main(("--settings-file", str(json_file))) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_check_has_enough_configured_memory(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")
    json_file.write_text('{"memoryMiB": 9001}')

    args = ("--settings-file", str(json_file), "--memory-minimum", "8092")
    assert docker_memory_check.main(args) == 0
    out, err = capsys.readouterr()
    assert out == err == ""


def test_check_insufficient_configured_memory(capsys, tmp_path):
    json_file = tmp_path.joinpath("settings.json")
    json_file.write_text('{"memoryMiB": 7000}')

    args = ("--settings-file", str(json_file), "--memory-minimum=8092", "--color=never")
    assert docker_memory_check.main(args) == 0
    out, err = capsys.readouterr()
    assert out == ""
    assert (
        err
        == """\
WARNING: docker is configured with less than the recommended minimum memory!
- open Docker.app and adjust the memory in Settings -> Resources
- current memory (MiB): 7000
- recommended minimum (MiB): 8092
"""
    )
