from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()


PROXY_PORT = 1540


def start_proxy_server():
    from mitmproxy.tools.main import mitmdump

    mitmdump(args=["-v", "-p", f"{PROXY_PORT}"])
