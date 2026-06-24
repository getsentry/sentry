from __future__ import annotations

import logging

import httpx
from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import HttpResponse
from django.urls import Resolver404, resolve

from sentry.hybridcloud.apigateway_async.apigateway import (
    _get_view_cell_resolver,
    _get_view_silo_mode,
)
from sentry.silo.base import SiloMode
from sentry.types.cell import get_cell_by_name, get_cell_for_organization

logger = logging.getLogger(__name__)
SENTRY_URLCONF = "sentry.conf.urls"

proxy_client = httpx.AsyncClient()  # TODO: add timeout


async def health_check(request):
    return HttpResponse("vjeran", content_type="text/plain")


async def proxy_view(request):
    try:
        match = resolve(request.path, urlconf=SENTRY_URLCONF)
    except Resolver404:
        return HttpResponse(status=404)

    url_name = match.url_name or "unknown"

    silo_modes = _get_view_silo_mode(match.func)
    if silo_modes and SiloMode.CELL in silo_modes:
        # cell endpoint - resolve org to cell, then proxy
        org = match.kwargs.get("organization_id_or_slug") or match.kwargs.get("organization_slug")
        if org:
            cell = await sync_to_async(get_cell_for_organization, thread_sensitive=True)(org)
            return await proxy_to_host(request, cell.address, url_name)

        # try custom cell resolver
        resolver = _get_view_cell_resolver(match.func)
        if resolver:
            cell = resolver.resolve(request, match.func, match.kwargs)
            if cell:
                return await proxy_to_host(request, cell.address, url_name)

        # fallback: region-pinned or legacy paths
        if url_name in settings.REGION_PINNED_URL_NAMES:
            cell = get_cell_by_name(settings.SENTRY_FALLBACK_CELL)
            return await proxy_to_host(request, cell.address, url_name)

    # Control endpoint (or no silo annotation) — proxy to control
    return await proxy_to_host(request, settings.SENTRY_CONTROL_ADDRESS, url_name)


async def proxy_to_host(request, host, url_name):
    # TODO: add circuitbreaker
    headers = ...
    try:
        req = httpx.Request(
            method=request.method,
            headers=headers,
            params=dict(request.query_params),
            content=request.body,
            # timeout= TODO: add timeout
        )
        resp = await proxy_client.send(req, stream=True, follow_redirects=False)
        return resp
    except:
        pass
