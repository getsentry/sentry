import logging
from typing import Any, Callable
from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponseBase
from rest_framework.request import Request

from sentry import options
from sentry.models.projectkeymapping import ProjectKeyMapping
from sentry.types.cell import Cell, get_cell_by_name

logger = logging.getLogger(__name__)


class CellRequestResolver:
    def resolve(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_kwargs: dict[str, Any],
    ) -> Cell | None:
        raise NotImplementedError


class SdkPublicKeyResolver(CellRequestResolver):
    def resolve(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_kwargs: dict[str, Any],
    ) -> Cell | None:
        public_key = view_kwargs.get("public_key")
        if not public_key:
            return None

        try:
            project_mapping = ProjectKeyMapping.objects.get_from_cache(public_key=public_key)
        except ProjectKeyMapping.DoesNotExist:
            return None

        return get_cell_by_name(project_mapping.cell_name)


class ErrorEmbedResolver(CellRequestResolver):
    def resolve(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_kwargs: dict[str, Any],
    ) -> Cell | None:
        dsn = request.GET.get("dsn")
        try:
            parsed = urlparse(dsn)
        except Exception as err:
            logger.info("apigateway.error_embed.invalid_dsn", extra={"dsn": dsn, "error": err})
            return None

        host = parsed.netloc
        app_host = urlparse(options.get("system.url-prefix")).netloc
        if not host.endswith(app_host):
            # Don't further parse URLs that aren't for us.
            return None

        app_segments = app_host.split(".")
        host_segments = host.split(".")
        if len(host_segments) - len(app_segments) < 3:
            # If we don't have a o123.ingest.{cell}.{app_host} style domain
            # we forward to the monolith cell
            cell = get_cell_by_name(settings.SENTRY_MONOLITH_REGION)
            return cell

        try:
            cell_offset = len(app_segments) + 1
            cell_segment = host_segments[cell_offset * -1]
            return get_cell_by_name(cell_segment)
        except Exception:
            return None


CellResolverMappings: dict[str, CellRequestResolver] = {
    "sentry-error-page-embed": ErrorEmbedResolver(),
    "sentry-js-sdk-loader": SdkPublicKeyResolver(),
}
