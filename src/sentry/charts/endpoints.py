import os.path

from django.http import HttpRequest
from django.views import static

import sentry

CONFIG_DIR = os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "..", "..", "config", "chartcuterie")
)


def serve_chartcuterie_config(
    request: HttpRequest,
):
    return static.serve(request, "config.js", document_root=CONFIG_DIR)
