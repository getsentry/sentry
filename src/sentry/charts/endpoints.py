import os.path
from typing import Union
from django.views import static

import sentry

from django.http import (
    FileResponse,
    Http404,
    HttpResponse,
    HttpResponseNotModified,
    HttpRequest,
)


CONFIG_DIR = os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "../../config/chartcuterie")
)


def serve_chartcuterie_config(
    request: HttpRequest,
) -> Union[FileResponse, Http404, HttpResponse, HttpResponseNotModified]:
    return static.serve(request, "config.js", document_root=CONFIG_DIR)
