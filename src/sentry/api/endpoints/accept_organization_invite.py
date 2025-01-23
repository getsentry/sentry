from __future__ import annotations

import logging
from collections.abc import Mapping

from django.http import HttpRequest
from django.urls import reverse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.invite_helper import (
    ApiInviteHelper,
    add_invite_details_to_session,
    remove_invite_details_from_session,
)
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import (
    RpcUserInviteContext,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.types.region import RegionResolutionError, get_region_by_name
from sentry.utils import auth

logger = logging.getLogger(__name__)


def handle_empty_organization_id_or_slug(
    member_id: int, user_id: int, request: HttpRequest | Request
) -> RpcUserInviteContext | None:
    member_mapping: OrganizationMemberMapping | None = None
    member_mappings: Mapping[int, OrganizationMemberMapping] = {
        omm.organization_id: omm
        for omm in OrganizationMemberMapping.objects.filter(organizationmember_id=member_id).all()
    }
    org_mappings = OrganizationMapping.objects.filter(
        organization_id__in=list(member_mappings.keys())
    )
    for mapping in org_mappings:
        try:
            if get_region_by_name(mapping.region_name).is_historic_monolith_region():
                member_mapping = member_mappings.get(mapping.organization_id)
                break
        except RegionResolutionError:
            pass

    if member_mapping is None:
        return None
    invite_context = organization_service.get_invite_by_id(
        organization_id=member_mapping.organization_id,
        organization_member_id=member_id,
        user_id=user_id,
    )

    logger.info(
        "organization.member_invite.no_id_or_slug",
        extra={
            "member_id": member_id,
            "org_id": member_mapping.organization_id,
            "url": request.path,
            "method": request.method,
        },
    )

    return invite_context


def get_invite_state(
    member_id: int,
    organization_id_or_slug: int | str | None,
    user_id: int,
    request: HttpRequest | Request,
) -> RpcUserInviteContext | None:

    if organization_id_or_slug is None:
        return handle_empty_organization_id_or_slug(member_id, user_id, request)

    else:
        if str(organization_id_or_slug).isdecimal():
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

    @staticmethod
    def respond_invalid() -> Response:
        return Response(status=status.HTTP_400_BAD_REQUEST, data={"details": "Invalid invite code"})

    def get_helper(
        self, request: Request, token: str, invite_context: RpcUserOrganizationContext
    ) -> ApiInviteHelper:
        return ApiInviteHelper(request=request, token=token, invite_context=invite_context)

    def get(
        self,
        request: Request,
        member_id: int,
        token: str,
        organization_id_or_slug: int | str | None = None,
    ) -> Response:

        invite_context = get_invite_state(
            member_id=int(member_id),
            organization_id_or_slug=organization_id_or_slug,
            user_id=request.user.id,
            request=request,
        )
        if invite_context is None:
            return self.respond_invalid()

        helper = self.get_helper(request, token, invite_context)

        organization_member = invite_context.member
        organization = invite_context.organization

        if (
            not helper.member_pending
            or not helper.valid_token
            or not organization_member.invite_approved
        ):
            return self.respond_invalid()

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
        member_id: int,
        token: str,
        organization_id_or_slug: int | str | None = None,
    ) -> Response:
        invite_context = get_invite_state(
            member_id=int(member_id),
            organization_id_or_slug=organization_id_or_slug,
            user_id=request.user.id,
            request=request,
        )
        if invite_context is None:
            return self.respond_invalid()

        helper = self.get_helper(request, token, invite_context)

        if helper.member_already_exists:
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

        helper.accept_invite()
        remove_invite_details_from_session(request)

        return response
