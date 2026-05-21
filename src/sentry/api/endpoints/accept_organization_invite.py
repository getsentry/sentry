from __future__ import annotations

from django.contrib.auth import logout
from django.http import HttpResponse
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.invite_helper import (
    ApiInviteHelper,
    add_invite_details_to_session,
    remove_invite_details_from_session,
)
from sentry.demo_mode.utils import is_demo_user
from sentry.models.authprovider import AuthProvider
from sentry.organizations.services.organization import RpcUserInviteContext, organization_service
from sentry.utils import auth


def get_invite_state(
    member_id: int,
    organization_id_or_slug: str,
    user_id: int | None,
) -> RpcUserInviteContext | None:
    if organization_id_or_slug.isdecimal():
        invite_context = organization_service.get_invite_by_id(
            organization_id=organization_id_or_slug,
            organization_member_id=member_id,
            user_id=user_id,
        )
    else:
        invite_context = organization_service.get_invite_by_slug(
            organization_member_id=member_id,
            slug=organization_id_or_slug,
            user_id=user_id,
        )

    return invite_context


@control_silo_endpoint
class AcceptOrganizationInvite(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    def convert_args(
        self,
        request: Request,
        member_id: str,
        token: str,
        organization_id_or_slug: str,
        *args,
        **kwargs,
    ):
        # Demo users will be logged out in get() before processing the invite,
        # so we should fetch the invite context as if they were anonymous.
        # This matches the original behavior where logout happened before get_invite_state().
        if request.user.is_authenticated and not is_demo_user(request.user):
            user_id: int | None = request.user.id
        else:
            user_id = None

        invite_context = get_invite_state(
            member_id=int(member_id),
            organization_id_or_slug=organization_id_or_slug,
            user_id=user_id,
        )
        if invite_context is None:
            raise ValidationError({"details": "Invalid invite code"})

        kwargs["invite_context"] = invite_context
        kwargs["token"] = token
        kwargs["member_id"] = member_id
        return (args, kwargs)

    def get_helper(
        self, request: Request, token: str, invite_context: RpcUserInviteContext
    ) -> ApiInviteHelper:
        return ApiInviteHelper(request=request, token=token, invite_context=invite_context)

    def get(
        self,
        request: Request,
        member_id: str,
        token: str,
        invite_context: RpcUserInviteContext,
        **kwargs,
    ) -> Response | HttpResponse:
        # Demo user can't accept invites, this invite is probably meant for another user
        # so we log out the demo user and let the invite flow continue since it can handle
        # unauthenticated users.
        if is_demo_user(request.user):
            logout(request)

        helper = self.get_helper(request, token, invite_context)

        organization_member = invite_context.member
        organization = invite_context.organization

        if (
            not helper.member_pending
            or not helper.valid_token
            or not organization_member
            or not organization_member.invite_approved
        ):
            return Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "Invalid invite code"}
            )

        # Keep track of the invite details in the request session
        request.session["invite_email"] = organization_member.email

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            auth_provider = None

        data = {
            "orgSlug": organization.slug,
            "needsAuthentication": not helper.user_authenticated,
            "needsSso": auth_provider is not None,
            "hasAuthProvider": auth_provider is not None,
            "requireSso": auth_provider is not None and not auth_provider.flags.allow_unlinked,
            # If they're already a member of the organization its likely
            # they're using a shared account and either previewing this invite
            # or are incorrectly expecting this to create a new account.
            "existingMember": helper.member_already_exists,
        }

        response = Response(None)

        # Allow users to register an account when accepting an invite
        if not helper.user_authenticated:
            request.session["can_register"] = True
            add_invite_details_to_session(
                request,
                organization_member.id,
                organization_member.token,
                invite_context.organization.id,
            )

            # When SSO is required do *not* set a next_url to return to accept
            # invite. The invite will be accepted after SSO is completed.
            url = (
                reverse(
                    "sentry-organization-accept-invite",
                    kwargs={
                        "organization_slug": invite_context.organization.slug,
                        "member_id": member_id,
                        "token": token,
                    },
                )
                if not auth_provider
                else "/"
            )
            auth.initiate_login(self.request, next_url=url)

        # If the org has SSO setup, we'll store the invite cookie to later
        # associate the org member after authentication. We can avoid needing
        # to come back to the accept invite page since 2FA will *not* be
        # required if SSO is required.
        if auth_provider is not None:
            add_invite_details_to_session(
                request,
                organization_member.id,
                organization_member.token,
                organization_member.organization_id,
            )

            provider = auth_provider.get_provider()
            data["ssoProvider"] = provider.name

        onboarding_steps = helper.get_onboarding_steps()
        data.update(onboarding_steps)
        if any(onboarding_steps.values()):
            add_invite_details_to_session(
                request,
                organization_member.id,
                organization_member.token,
                invite_context.organization.id,
            )

        response.data = data

        return response

    def post(
        self,
        request: Request,
        token: str,
        invite_context: RpcUserInviteContext,
        **kwargs,
    ) -> Response:
        if is_demo_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        helper = self.get_helper(request, token, invite_context)

        if not request.user.is_authenticated:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "unable to accept organization invite"},
            )
        elif helper.member_already_exists:
            response = Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "member already exists"}
            )
        elif not helper.valid_request:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "unable to accept organization invite"},
            )
        else:
            response = Response(status=status.HTTP_204_NO_CONTENT)

        helper.accept_invite(request.user)
        remove_invite_details_from_session(request)

        return response
