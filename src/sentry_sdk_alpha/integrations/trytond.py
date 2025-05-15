import sentry_sdk_alpha
from sentry_sdk_alpha.integrations import _check_minimum_version, Integration
from sentry_sdk_alpha.integrations.wsgi import SentryWsgiMiddleware
from sentry_sdk_alpha.utils import ensure_integration_enabled, event_from_exception

from trytond import __version__ as trytond_version  # type: ignore
from trytond.exceptions import TrytonException  # type: ignore
from trytond.wsgi import app  # type: ignore


# TODO: trytond-worker, trytond-cron and trytond-admin intergations


class TrytondWSGIIntegration(Integration):
    identifier = "trytond_wsgi"
    origin = f"auto.http.{identifier}"

    def __init__(self):  # type: () -> None
        pass

    @staticmethod
    def setup_once():  # type: () -> None
        _check_minimum_version(TrytondWSGIIntegration, trytond_version)

        app.wsgi_app = SentryWsgiMiddleware(
            app.wsgi_app,
            span_origin=TrytondWSGIIntegration.origin,
        )

        @ensure_integration_enabled(TrytondWSGIIntegration)
        def error_handler(e):  # type: (Exception) -> None
            if isinstance(e, TrytonException):
                return
            else:
                client = sentry_sdk_alpha.get_client()
                event, hint = event_from_exception(
                    e,
                    client_options=client.options,
                    mechanism={"type": "trytond", "handled": False},
                )
                sentry_sdk_alpha.capture_event(event, hint=hint)

        # Expected error handlers signature was changed
        # when the error_handler decorator was introduced
        # in Tryton-5.4
        if hasattr(app, "error_handler"):

            @app.error_handler
            def _(app, request, e):  # type: ignore
                error_handler(e)

        else:
            app.error_handlers.append(error_handler)
