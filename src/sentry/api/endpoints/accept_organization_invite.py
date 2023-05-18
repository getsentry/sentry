from typing import Optional

from django.urls import reverse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.invite_helper import (
    ApiInviteHelper,
    add_invite_details_to_session,
    remove_invite_details_from_session,
)
from sentry.models import AuthProvider, Organization, OrganizationMember
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils import auth


@region_silo_endpoint
class AcceptOrganizationInvite(Endpoint):
    # Disable authentication and permission requirements.
    permission_classes = []

    @staticmethod
    def respond_invalid() -> Response:
        return Response(status=status.HTTP_400_BAD_REQUEST, data={"details": "Invalid invite code"})

    def get_helper(
        self, request: Request, organization_id: int, member_id: int, token: str
    ) -> ApiInviteHelper:
        rpc_org_member = organization_service.get_organization_member(
            organization_id=organization_id, organization_member_id=member_id
        )
        return ApiInviteHelper(
            request=request, rpc_org_member=rpc_org_member, instance=self, token=token
        )

    def get(
        self, request: Request, member_id: int, token: str, organization_slug: Optional[str] = None
    ) -> Response:
        # TODO: fix this later
        member = OrganizationMember.objects.filter(id=member_id)
        if not member.exists():
            return self.respond_invalid()
        member = member.get()
        helper = self.get_helper(
            request=request,
            organization_id=member.organization_id,
            member_id=member_id,
            token=token,
        )
        if helper.om is None:
            return self.respond_invalid()

        organization_member = helper.om
        organization_id = helper.organization_id
        organization = Organization.objects.get(id=organization_id)

        if organization_slug:
            if organization_slug != organization.slug:
                return self.respond_invalid()
        else:
            organization_slug = organization.slug

        if (
            not helper.member_pending
            or not helper.valid_token
            or not organization_member.invite_approved
        ):
            return self.respond_invalid()

        # Keep track of the invite details in the request session
        request.session["invite_email"] = organization_member.email

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization_id)
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
                organization_id=organization_member.organization_id,
                member_id=organization_member.id,
                token=organization_member.token,
            )

            # When SSO is required do *not* set a next_url to return to accept
            # invite. The invite will be accepted after SSO is completed.
            url = (
                reverse("sentry-accept-invite", args=[member_id, token])
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
                organization_id=organization_member.organization_id,
                member_id=organization_member.id,
                token=organization_member.token,
            )

            provider = auth_provider.get_provider()
            data["ssoProvider"] = provider.name

        onboarding_steps = helper.get_onboarding_steps()
        data.update(onboarding_steps)
        if any(onboarding_steps.values()):
            add_invite_details_to_session(
                request,
                organization_id=organization_member.organization_id,
                member_id=organization_member.id,
                token=organization_member.token,
            )

        response.data = data

        return response

    def post(
        self, request: Request, member_id: int, token: str, organization_slug: Optional[str] = None
    ) -> Response:
        # TODO: fix this later
        member = OrganizationMember.objects.get(id=member_id)
        helper = self.get_helper(
            request=request,
            organization_id=member.organization_id,
            member_id=member_id,
            token=token,
        )
        if helper.om is None:
            return self.respond_invalid()

        if not helper.valid_request:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "unable to accept organization invite"},
            )

        if helper.member_already_exists:
            response = Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "member already exists"}
            )
        else:
            response = Response(status=status.HTTP_204_NO_CONTENT)

        organization = Organization.objects.get(id=helper.organization_id)

        if organization_slug:
            if organization_slug != organization.slug:
                return self.respond_invalid()

        helper.accept_invite()
        remove_invite_details_from_session(request)

        return response
