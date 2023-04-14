from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()


PROXY_PORT = 1540


def start_proxy_server():
    import os

    from mitmproxy.tools.main import mitmdump

    cwd = os.path.dirname(os.path.realpath(__file__))
    mitmdump(args=["-p", f"{PROXY_PORT}", "-s", f"{cwd}/logic.py"])
