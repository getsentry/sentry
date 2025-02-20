__all__ = ["DummyProvider"]

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.identity.base import Provider
from sentry.pipeline import PipelineView


class AskEmail(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        if "email" in request.POST:
            pipeline.bind_state("email", request.POST.get("email"))
            return pipeline.next_step()

        return HttpResponse(DummyProvider.TEMPLATE)


class DummyProvider(Provider):
    name = "Dummy"
    key = "dummy"

    TEMPLATE = '<form method="POST"><input type="email" name="email" /></form>'

    def get_pipeline_views(self) -> list[PipelineView]:
        return [AskEmail()]

    def build_identity(self, state):
        return {"id": state["email"], "email": state["email"], "name": "Dummy"}

    def refresh_identity(self, auth_identity, *args, **kwargs):
        pass
