from typing import Any

from django.db import router, transaction
from fido2.ctap2 import AuthenticatorData
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.u2f import U2fInterface, decode_credential_id
from sentry.auth.staff import has_staff_option, is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.security.utils import capture_security_activity
from sentry.users.api.bases.user import OrganizationUserPermission, UserEndpoint
from sentry.users.api.serializers.authenticator import get_interface_serializer
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.utils.auth import MFA_SESSION_KEY


@control_silo_endpoint
class UserAuthenticatorDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrganizationUserPermission,)

    def _get_device_for_rename(
        self, authenticator: Authenticator, interface_device_id: str | None
    ) -> dict[str, Any] | None:
        devices = authenticator.config
        for device in devices["devices"]:
            # this is for devices registered with webauthn, since the stored data is not a string, we need to decode it
            if isinstance(device["binding"], AuthenticatorData):
                if decode_credential_id(device) == interface_device_id:
                    return device
            elif device["binding"]["keyHandle"] == interface_device_id:
                return device
        return None

    def _rename_device(
        self, authenticator: Authenticator, interface_device_id: str | None, new_name: str
    ) -> Response:
        device = self._get_device_for_rename(authenticator, interface_device_id)
        if not device:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        device["name"] = new_name
        authenticator.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _regenerate_recovery_code(
        self, authenticator: Authenticator, request: Request, user: User
    ) -> Response:
        interface = authenticator.interface

        if isinstance(interface, RecoveryCodeInterface) and interface.interface_id == "recovery":
            interface.regenerate_codes()

            capture_security_activity(
                account=user,
                type="recovery-codes-regenerated",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator},
                send_email=True,
            )
        return Response(serialize(interface, serializer=get_interface_serializer(interface)))

    @sudo_required
    def get(self, request: Request, user: User, auth_id: str) -> Response:
        """
        Get Authenticator Interface
        ```````````````````````````

        Retrieves authenticator interface details for user depending on user enrollment status

        :pparam string user_id: user id or "me" for current user
        :pparam string auth_id: authenticator model id

        :auth: required
        """

        try:
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        # User is enrolled to auth interface:
        # - display interface details
        # - show enrolled specific details like:
        #    - created at, last used dates
        #    - phone number for SMS
        #    - recovery codes
        response = serialize(interface, serializer=get_interface_serializer(interface))
        if interface.interface_id == "recovery":
            assert isinstance(
                interface, RecoveryCodeInterface
            ), "Interace must be RecoveryCodeInterface to get unused codes"
            response["codes"] = interface.get_unused_codes()
        if interface.interface_id == "u2f":
            assert isinstance(
                interface, U2fInterface
            ), "Interace must be U2fInterface to get registered devices"
            response["devices"] = interface.get_registered_devices()

        return Response(response)

    @sudo_required
    def put(
        self, request: Request, user: User, auth_id: str, interface_device_id: str | None = None
    ) -> Response:
        """
        Modify authenticator interface
        ``````````````````````````````

        Currently, only supports regenerating recovery codes

        :pparam string user_id: user id or 'me' for current user
        :pparam int auth_id: authenticator model id

        :auth required:
        """
        # TODO: temporary solution for both renaming and regenerating recovery code.
        # Need to find new home for regenerating recovery codes as it doesn't really do what put is supposed to do
        try:
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.data.get("name"):
            return self._rename_device(
                authenticator, interface_device_id, str(request.data.get("name"))
            )
        else:
            return self._regenerate_recovery_code(authenticator, request, user)

    @sudo_required
    def delete(
        self, request: Request, user: User, auth_id: str, interface_device_id: str | None = None
    ) -> Response:
        """
        Remove authenticator
        ````````````````````

        :pparam string user_id: user id or 'me' for current user
        :pparam string auth_id: authenticator model id
        :pparam string interface_device_id: some interfaces (u2f) allow multiple devices

        :auth required:
        """
        try:
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface
        # Remove a single device and not entire authentication method
        if interface.interface_id == "u2f" and interface_device_id is not None:
            assert isinstance(
                interface, U2fInterface
            ), "Interace must be U2fInterface to get registered devices"
            device_name = interface.get_device_name(interface_device_id)
            # Can't remove if this is the last device, will return False if so
            if not interface.remove_u2f_device(interface_device_id):
                return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            assert interface.authenticator, "Interface must have an authenticator to save"
            interface.authenticator.save()

            capture_security_activity(
                account=user,
                type="mfa-removed",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator, "device_name": device_name},
                send_email=True,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # We should only be able to delete the last auth method through the
        # _admin portal, which is indicated by staff. After the option is
        # removed, this will only check for is_active_staff.
        if has_staff_option(request.user):
            check_remaining_auth = not is_active_staff(request)
        else:
            check_remaining_auth = not is_active_superuser(request)

        if check_remaining_auth:
            # if the user's organization requires 2fa,
            # don't delete the last auth method
            enrolled_methods = Authenticator.objects.all_interfaces_for_user(
                user, ignore_backup=True
            )
            last_2fa_method = len(enrolled_methods) == 1
            require_2fa = user.has_org_requiring_2fa()

            if require_2fa and last_2fa_method:
                return Response(
                    {"detail": "Cannot delete authenticator because organization requires 2FA"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        interfaces = Authenticator.objects.all_interfaces_for_user(user)

        with transaction.atomic(using=router.db_for_write(Authenticator)):
            authenticator.delete()

            # if we delete an actual authenticator and all that
            # remains are backup interfaces, then we kill them in the
            # process.
            if not interface.is_backup_interface:
                backup_interfaces = [x for x in interfaces if x.is_backup_interface]
                if len(backup_interfaces) == len(interfaces):
                    for iface in backup_interfaces:
                        assert iface.authenticator, "Interface must have an authenticator to delete"
                        iface.authenticator.delete()

                    # wait to generate entries until all pending writes
                    # have been sent to db
                    for iface in backup_interfaces:
                        capture_security_activity(
                            account=request.user,
                            type="mfa-removed",
                            actor=request.user,
                            ip_address=request.META["REMOTE_ADDR"],
                            context={"authenticator": iface.authenticator},
                            send_email=False,
                        )

            capture_security_activity(
                account=user,
                type="mfa-removed",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator},
                send_email=not interface.is_backup_interface,
            )

        request.session.pop(MFA_SESSION_KEY, None)

        return Response(status=status.HTTP_204_NO_CONTENT)
