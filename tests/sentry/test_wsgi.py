import inspect
import subprocess
import sys


def subprocess_test_wsgi_warmup():
    # isort: off
    import sentry.wsgi  # noqa
    import sys

    assert "django.urls.resolvers" in sys.modules

    import django.urls.resolvers

    resolver = django.urls.resolvers.get_resolver()
    assert resolver._populated is True  # type: ignore[attr-defined]


def test_wsgi_init():
    """
    This test ensures that the wsgi.py file correctly pre-loads the application and
    various resources we want to be "warm"
    """
    subprocess_test = "\n".join(
        line.lstrip() for line in inspect.getsource(subprocess_test_wsgi_warmup).splitlines()[1:]
    )
    process = subprocess.run(
        [sys.executable, "-c", subprocess_test],
        capture_output=True,
        text=True,
    )
    assert process.returncode == 0, process.stderr + process.stdout
