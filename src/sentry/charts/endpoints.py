import os.path

from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.views import static

import sentry
from sentry.web.frontend.base import all_silo_view

CONFIG_DIR = os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "..", "..", "config", "chartcuterie")
)


@all_silo_view
def serve_chartcuterie_config(
    request: HttpRequest,
) -> HttpResponseBase:
    return static.serve(request, "config.js", document_root=CONFIG_DIR)
