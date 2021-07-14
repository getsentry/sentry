from .pickle import patch_pickle_loaders


def register_scheme(name):
    from urllib import parse as urlparse  # NOQA

    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def patch_httprequest_repr():
    try:
        from django.http import HttpRequest
    except ImportError:
        # This module is potentially imported before Django is installed
        # during a setup.py run
        return

    # Intentionally strip all GET/POST/COOKIE values out of repr() for HttpRequest
    # and subclass WSGIRequest. This prevents sensitive information from getting
    # logged. This was yanked out of Django master anyhow.
    # https://code.djangoproject.com/ticket/12098
    def safe_httprequest_repr(self):
        return f"<{self.__class__.__name__}: {self.method} {self.get_full_path()!r}>"

    HttpRequest.__repr__ = safe_httprequest_repr


def patch_django_runserver():
    # This patch from django@934acf1126995f6e6ccba5947ec8f7561633c27f is needed
    # to fix symbolicator tests on Django 2.0. Otherwise, symbolicator will attempt
    # to GET DebugFilesEndpoint and fail when django liveserver closes conns prematurely.
    # Can be removed in Django >= 2.1.4.

    try:
        import django.core.servers.basehttp
    except ImportError:
        return

    def _cleanup_headers(self):
        super(django.core.servers.basehttp.ServerHandler, self).cleanup_headers()
        if "Content-Length" not in self.headers:
            self.headers["Connection"] = "close"
        if self.headers.get("Connection") == "close":
            self.request_handler.close_connection = True

    django.core.servers.basehttp.ServerHandler.cleanup_headers = _cleanup_headers

    import socket

    def _handle_one_request(self):
        self.raw_requestline = self.rfile.readline(65537)
        if len(self.raw_requestline) > 65536:
            self.requestline = ""
            self.request_version = ""
            self.command = ""
            self.send_error(414)
            return

        if not self.parse_request():
            return

        handler = django.core.servers.basehttp.ServerHandler(
            self.rfile, self.wfile, self.get_stderr(), self.get_environ()
        )
        handler.request_handler = self
        handler.run(self.server.get_app())

    django.core.servers.basehttp.WSGIRequestHandler.handle_one_request = _handle_one_request

    def _handle(self):
        self.close_connection = True
        self.handle_one_request()
        while not self.close_connection:
            self.handle_one_request()
        try:
            self.connection.shutdown(socket.SHUT_WR)
        except (OSError, AttributeError):
            pass

    django.core.servers.basehttp.WSGIRequestHandler.handle = _handle


def patch_django_views_debug():
    # Prevent exposing any Django SETTINGS on our debug error page
    # This information is not useful for Sentry development
    # and poses a significant security risk if this is exposed by accident
    # in any production system if, by change, it were deployed
    # with DEBUG=True.
    try:
        from django.views import debug
    except ImportError:
        return

    debug.get_safe_settings = lambda: {}


def patch_celery_imgcat():
    # Remove Celery's attempt to display an rgb image in iTerm 2, as that
    # attempt just prints out base64 trash in tmux.
    try:
        from celery.utils import term
    except ImportError:
        return

    term.imgcat = lambda *a, **kw: b""


for patch in (
    patch_httprequest_repr,
    patch_django_runserver,
    patch_django_views_debug,
    patch_celery_imgcat,
    patch_pickle_loaders,
):
    patch()
