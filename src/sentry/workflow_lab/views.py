import mimetypes
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpRequest, HttpResponse
from django.middleware.csrf import get_token
from django.template import engines
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe

from sentry.web.client_config import get_client_config

ROOT = Path(__file__).resolve().parent


@login_required
@never_cache
@require_safe
def page(
    request: HttpRequest, organization_id_or_slug: str, notebook: bool = False
) -> HttpResponse:
    if not settings.DEBUG:
        raise Http404
    template = engines["django"].from_string(
        (ROOT / ("notebook.html" if notebook else "index.html")).read_text()
    )
    context = {
        "organization": organization_id_or_slug,
        "user_id": request.user.id,
        "csrf": get_token(request),
        "react_config": get_client_config(request) if notebook else None,
    }
    response = HttpResponse(template.render(context, request))
    if notebook:
        response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@require_safe
def asset(request: HttpRequest, organization_id_or_slug: str, name: str) -> HttpResponse:
    path = ROOT / "assets" / name
    if not settings.DEBUG or not path.is_file():
        raise Http404
    return HttpResponse(path.read_bytes(), content_type=mimetypes.guess_type(name)[0])
