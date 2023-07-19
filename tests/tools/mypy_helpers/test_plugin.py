import contextlib
import os
import subprocess

mypy_config = "./types_mypy.ini"
test_file = "./mypy_plugin_test_subject.py"


@contextlib.contextmanager
def create_mypy_config():
    contents = f"""
[mypy]
python_version = 3.8
plugins = tools.mypy_helpers.plugin
files = {test_file}

# minimal strictness settings
check_untyped_defs = true
no_implicit_reexport = true
warn_unreachable = true
warn_unused_configs = true
warn_unused_ignores = true
warn_redundant_casts = true

"""
    f = open(mypy_config, "w")
    f.write(contents)
    f.close()

    yield

    os.remove(mypy_config)


@contextlib.contextmanager
def write_sample_file(contents: str):
    f = open(test_file, "w")
    f.write(contents)
    f.close()

    yield

    os.remove(test_file)


def test_invalid_get_connection_call():
    code = """
from django.db.transaction import get_connection

with get_connection() as cursor:
    cursor.execute("SELECT 1")
"""
    with write_sample_file(code), create_mypy_config():
        process = subprocess.run(
            ["mypy", "--config", "./types_mypy.ini", test_file],
            capture_output=True,
            env=os.environ,
        )
        output = process.stdout.decode("utf8")
        assert "Found 1 error" in output, output
        assert 'Missing positional argument "using" in call to "get_connection"' in output, output


def test_ok_get_connection():
    code = """
from django.db.transaction import get_connection

with get_connection("default") as cursor:
    cursor.execute("SELECT 1")
"""
    with write_sample_file(code), create_mypy_config():
        process = subprocess.run(
            ["mypy", "--config", "./types_mypy.ini", test_file],
            capture_output=True,
        )
        output = process.stdout.decode("utf8")
        assert "Success: no issues found" in output, output


def test_invalid_transaction_atomic():
    code = """
from django.db import transaction

with transaction.atomic():
    value = 10 / 2
"""
    with write_sample_file(code), create_mypy_config():
        process = subprocess.run(
            ["mypy", "--config", "./types_mypy.ini", test_file],
            capture_output=True,
        )
        output = process.stdout.decode("utf8")
        assert "Found 1 error" in output, output
        assert 'All overload variants of "atomic" require at least one argument' in output, output


def test_ok_transaction_atomic():
    code = """
from django.db import transaction

with transaction.atomic("default"):
    value = 10 / 2
"""
    with write_sample_file(code), create_mypy_config():
        process = subprocess.run(
            ["mypy", "--config", "./types_mypy.ini", test_file],
            capture_output=True,
        )
        output = process.stdout.decode("utf8")
        assert "Success: no issues found" in output, output
