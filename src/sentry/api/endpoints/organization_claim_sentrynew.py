"""
API endpoint for claiming SentryNew organizations.

This endpoint allows users to claim a temporary SentryNew organization
and convert it to a permanent free-tier account.
"""

import logging

import sentry_sdk
from django.utils import timezone

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.utils.audit import create_audit_entry
from sentry.utils.email import MessageBuilder

logger = logging.getLogger("sentry.api.sentrynew")


def _get_cleanup_service():
    """Deferred import to avoid loading getsentry models during URL resolution."""
    try:
        from getsentry.tasks.sentrynew_cleanup import SentryNewCleanupService

        return SentryNewCleanupService
    except ImportError:
        logger.warning("sentrynew.claim.cleanup_service_unavailable, using fallback")
        return None


class _FallbackCleanupService:
    """Fallback if getsentry cleanup service is unavailable."""

    @classmethod
    def mark_claimed(cls, partner_account, user_id=None, user_email=None):
        from django.utils import timezone

        try:
            metadata = partner_account.metadata or {}
            metadata.update(
                {
                    "claimed": True,
                    "claimed_at": timezone.now().isoformat(),
                    "claimed_by": user_id,
                    "claimed_by_email": user_email,
                    "sentrynew_session": True,
                }
            )
            partner_account.metadata = metadata
            partner_account.save(update_fields=["metadata"])
            return True
        except Exception as e:
            logger.error(f"Failed to claim org {partner_account.id}: {e}")
            return False


@region_silo_endpoint
class OrganizationClaimSentryNewEndpoint(OrganizationEndpoint):
    """
    POST /api/0/organizations/{organization_slug}/claim-sentrynew/

    Claim a SentryNew organization to prevent automatic deletion and
    convert it to a permanent free-tier organization.
    """

    publish_status = {
        "POST": "private",  # Internal API
    }

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Claim a SentryNew organization.

        This endpoint:
        1. Verifies the user is a member of the organization
        2. Verifies it's a SentryNew organization
        3. Marks it as claimed (prevents deletion)
        4. Sends a confirmation email
        5. Creates an audit log entry
        """

        # Verify user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED
            )

        # Verify user is a member of the organization
        try:
            member = OrganizationMember.objects.get(
                organization=organization, user_id=request.user.id
            )
        except OrganizationMember.DoesNotExist:
            logger.warning(
                "sentrynew.claim.not_member",
                extra={"organization_id": organization.id, "user_id": request.user.id},
            )
            return Response(
                {"detail": "You must be a member of this organization to claim it"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verify it's a SentryNew organization
        # Import deferred to avoid circular import during URL resolution
        from getsentry.models.partneraccount import PartnerAccount, PartnerAccountType

        try:
            partner_account = PartnerAccount.objects.get(
                organization_id=organization.id, type=PartnerAccountType.SENTRYNEW, is_active=True
            )
        except PartnerAccount.DoesNotExist:
            logger.warning(
                "sentrynew.claim.not_sentrynew", extra={"organization_id": organization.id}
            )
            return Response(
                {"detail": "This is not a SentryNew trial organization"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if already claimed - check metadata, not partnership_agreement_restricted
        # partnership_agreement_restricted just means the modal was dismissed
        metadata = partner_account.metadata or {}
        if metadata.get("claimed") == True:
            logger.info(
                "sentrynew.claim.already_claimed",
                extra={
                    "organization_id": organization.id,
                    "partner_account_id": partner_account.id,
                    "metadata_claimed": metadata.get("claimed"),
                },
            )
            return Response(
                {
                    "detail": "This organization has already been claimed",
                    "organization": serialize(organization),
                    "claimed": True,
                    "claimed_at": metadata.get("claimed_at"),
                },
                status=status.HTTP_200_OK,  # Not an error, just already done
            )

        # Claim the organization
        success = self._claim_organization(
            partner_account=partner_account,
            user=request.user,
            organization=organization,
            request=request,
        )

        if success:
            # Send confirmation email (async, don't block response)
            try:
                self._send_confirmation_email(user=request.user, organization=organization)
            except Exception as e:
                # Log but don't fail the claim
                sentry_sdk.capture_exception(e)
                logger.error(
                    "sentrynew.claim.email_failed",
                    extra={
                        "organization_id": organization.id,
                        "user_id": request.user.id,
                        "error": str(e),
                    },
                )

            logger.info(
                "sentrynew.claim.success",
                extra={
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                    "partner_account_id": partner_account.id,
                },
            )

            return Response(
                {
                    "success": True,
                    "organization": serialize(organization),
                    "message": "Organization claimed successfully. A confirmation email has been sent.",
                    "claimed": True,
                    "claimed_at": timezone.now().isoformat(),
                },
                status=status.HTTP_200_OK,
            )

        # Claim failed
        logger.error(
            "sentrynew.claim.failed",
            extra={
                "organization_id": organization.id,
                "user_id": request.user.id,
                "partner_account_id": partner_account.id,
            },
        )

        return Response(
            {"detail": "Failed to claim organization. Please try again or contact support."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    def _claim_organization(
        self, partner_account, user, organization: Organization, request: Request
    ) -> bool:
        """
        Mark the organization as claimed.

        Args:
            partner_account: The PartnerAccount to claim
            user: The user claiming the org
            organization: The Organization being claimed
            request: The HTTP request (for audit logging)

        Returns:
            True if successfully claimed, False otherwise
        """
        try:
            # Use the cleanup service to mark as claimed
            CleanupService = _get_cleanup_service() or _FallbackCleanupService
            service = CleanupService()
            success = service.mark_claimed(
                partner_account=partner_account, user_id=user.id, user_email=user.email
            )

            if success:
                # Create audit log entry
                try:
                    create_audit_entry(
                        request=request,
                        organization=organization,
                        target_object=organization.id,
                        event=audit_log.get_event_id("ORG_EDIT"),
                        data={
                            "sentrynew_claimed": True,
                            "claimed_by": user.email,
                            "claimed_at": timezone.now().isoformat(),
                            "partner_account_id": partner_account.id,
                        },
                    )
                except Exception as audit_error:
                    # Don't fail the claim if audit logging fails
                    logger.error(
                        "sentrynew.claim.audit_failed",
                        extra={"organization_id": organization.id, "error": str(audit_error)},
                    )

            return success

        except Exception as e:
            sentry_sdk.capture_exception(e)
            logger.error(
                "sentrynew.claim.exception",
                extra={
                    "organization_id": organization.id,
                    "partner_account_id": partner_account.id,
                    "error": str(e),
                },
            )
            return False

    def _send_confirmation_email(self, user, organization: Organization) -> None:
        """
        Send confirmation email after claiming organization.

        Args:
            user: The user who claimed the org
            organization: The claimed organization
        """
        try:
            # Build the email context
            context = {
                "user": user,
                "user_name": user.name or user.email,
                "organization": organization,
                "organization_name": organization.name,
                "organization_slug": organization.slug,
                "claim_date": timezone.now(),
                "login_url": organization.absolute_url(
                    f"/organizations/{organization.slug}/issues/"
                ),
                "settings_url": organization.absolute_url(f"/settings/{organization.slug}/"),
                "invite_url": organization.absolute_url(f"/settings/{organization.slug}/members/"),
            }

            # Create and send the email
            msg = MessageBuilder(
                subject=f"SentryNew Organization Claimed: {organization.name}",
                template="emails/sentrynew-claim-confirmation.txt",
                html_template="emails/sentrynew-claim-confirmation.html",
                context=context,
                type="organization.sentrynew_claimed",
            )

            msg.send_async([user.email])

            logger.info(
                "sentrynew.claim.email_sent",
                extra={"organization_id": organization.id, "user_email": user.email},
            )

        except Exception as e:
            # Email failures shouldn't break the claim process
            sentry_sdk.capture_exception(e)
            logger.error(
                "sentrynew.claim.email_error",
                extra={"organization_id": organization.id, "user_id": user.id, "error": str(e)},
            )
            raise  # Re-raise to be caught by caller
