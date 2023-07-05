from django.db import transaction
from django.http import HttpResponse
from django.urls import reverse
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry.services.hybrid_cloud.organization import organization_service
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView


class AuthOrganizationIdentifierLoginView(AuthOrganizationLoginView):
    @never_cache
    @transaction.atomic
    def handle(self, request: Request, organization_id) -> HttpResponse:
        organization_context = organization_service.get_organization_by_id(
            id=organization_id,
        )

        if request.user.is_authenticated:
            next_uri = self.get_next_uri(request)
            if next_uri:
                return self.redirect(next_uri)
            else:
                return self.redirect(reverse("issues"))
        return AuthOrganizationLoginView.handle(
            self, request, organization_slug=organization_context.organization.slug
        )
