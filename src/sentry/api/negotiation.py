from __future__ import annotations

from collections.abc import Iterable

from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.renderers import BaseRenderer
from rest_framework.request import Request


class PassthroughContentNegotiation(DefaultContentNegotiation):
    """
    Lets a request reach the handler whatever its `Accept` header asks for.

    DRF picks a renderer before the handler runs, and answers 406 when none of the endpoint's
    renderers matches `Accept`. An endpoint that relays an upstream's bytes in its own
    `HttpResponse` renders nothing, so that check would only turn away clients asking for the
    upstream's media types. This always selects the endpoint's first renderer instead, which DRF
    uses only for the `Response` objects the endpoint returns itself, such as errors. It ignores
    DRF's `format` query parameter for the same reason.
    """

    def select_renderer(
        self,
        request: Request,
        renderers: Iterable[BaseRenderer],
        format_suffix: str | None = None,
    ) -> tuple[BaseRenderer, str]:
        renderer = next(iter(renderers))
        return renderer, renderer.media_type
