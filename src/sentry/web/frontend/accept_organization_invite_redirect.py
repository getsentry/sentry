from __future__ import annotations

from django.http import HttpRequest, HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.urls import reverse

from sentry.api.endpoints.accept_organization_invite import get_invite_state
from sentry.api.invite_helper import ApiInviteHelper
from sentry.demo_mode.utils import is_demo_user
from sentry.utils.http import query_string
from sentry.web.frontend.react_page import GenericReactPageView


# TODO(cells): Temporary redirect to support previous invitations. Remove after May 8th
class AcceptOrganizationInviteRedirectView(GenericReactPageView):
    auth_required = False

    def handle(self, request: HttpRequest, **kwargs) -> HttpResponse:
        member_id: str = kwargs["member_id"]
        token: str = kwargs["token"]
        if request.user.is_authenticated and not is_demo_user(request.user):
            user_id: int | None = request.user.id
        else:
            user_id = None

        invite_context = get_invite_state(
            member_id=int(member_id),
            organization_id_or_slug=None,
            user_id=user_id,
            request=request,
        )
        if invite_context is None:
            return HttpResponseNotFound()

        helper = ApiInviteHelper(request=request, token=token, invite_context=invite_context)
        if not helper.valid_token:
            return HttpResponseNotFound()

        redirect_url = reverse(
            "sentry-organization-accept-invite",
            kwargs={
                "organization_slug": invite_context.organization.slug,
                "member_id": member_id,
                "token": token,
            },
        )
        return HttpResponseRedirect(f"{redirect_url}{query_string(request)}")
