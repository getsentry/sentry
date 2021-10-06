"""Sentry API to manage the App Store Connect credentials for a project.

There are currently two sets of credentials required:
- API credentials
- iTunes credentials

Note that for the iTunes credential Sentry needs to keep a session alive, which typically
lasts not very long.  The UI may need to re-fresh these using endpoints 2-4 at regular
intervals.

To create and manage these credentials, several API endpoints exist:

1. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/apps/``

   This will validate the API credentials and return the list of available applications if
   valid, or 401 if invalid.  See :class:`AppStoreConnectAppsEndpoint`.

2. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/start/``

   This starts an iTunes login, either brand new credentials or re-authenticate an existing
   session.  The user will be prompted with a 2FA code on their device, jump to endpoint 4.
   See :class:`AppStoreConnectStartAuthEndpoint`.

3. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``

   If after endpoint 2 the user wants to receive the 2FA code with SMS instead, call this.
   See :class:`AppStoreConnectRequestSmsmEndpoint`.

4. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``

   Complete the 2FA iTunes authentication stated in endpoint 2 by verifying the 2FA code.
   See :class:`AppStoreConnect2FactorAuthEndpoint`.

5. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/``

   Finalise complete authentication, returns full ``symbolSource`` settings to be saved in
   the project details.  This includes an ``id`` which identifies this set of credentials
   and can be used in e.g. endpoint 6 and 7.  See
   :class:`AppStoreConnectCreateCredentialsEndpoint`.

6. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``

   Update a subset of the full credentials normally saved in endpoint 5.  Like endpoint 5 it
   returns the entire symbol source JSON config to be saved in project details.  See
   :class:`AppStoreConnectUpdateCredentialsEndpoint`.

7. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

   Validate if an existing iTunes session is still active or if a new one needs to be
   initiated by steps 2-4.  See :class:`AppStoreConnectCredentialsValidateEndpoint`.
"""
import datetime
import logging
from typing import Dict, Optional, Union
from uuid import uuid4

import requests
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.api.exceptions import (
    AppConnectAuthenticationError,
    AppConnectMultipleSourcesError,
    ItunesAuthenticationError,
    ItunesSmsBlocked,
    ItunesTwoFactorAuthenticationRequired,
)
from sentry.api.fields.secret import SecretField, validate_secret
from sentry.lang.native import appconnect
from sentry.lang.native.symbolicator import redact_source_secrets, secret_fields
from sentry.models import AppConnectBuild, AuditLogEntryEvent, LatestAppConnectBuildsCheck, Project
from sentry.tasks.app_store_connect import dsym_download
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect, itunes_connect

logger = logging.getLogger(__name__)


# The feature which allows multiple sources per project.
MULTIPLE_SOURCES_FEATURE_NAME = "organizations:app-store-connect-multiple"


class AppStoreConnectCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectAppsEndpoint."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=False)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=False)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=False)
    # Optional ID to update existing credentials or simply list apps
    id = serializers.CharField(max_length=40, min_length=1, required=False)


class AppStoreConnectAppsEndpoint(ProjectEndpoint):  # type: ignore
    """Retrieves available applications with provided credentials.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/apps/``

    ```json
    {
        "appconnectIssuer": "abc123de-7744-7777-b032-5b8c7aaaa4d1",
        "appconnectKey": "ABC123DEFG",
        "appconnectPrivateKey": "----BEGIN PRIVATE KEY-...-END PRIVATE KEY----"
    }
    ```
    See :class:`AppStoreConnectCredentialsSerializer` for input validation.

    If you want to list the apps for an existing session you can use the ``id`` as created
    by :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``) instead:
    ```json
    {
        "id": "xxx",
    }
    In this case it is also possible to provide the other fields if you want to change any
    of them.

    Practically this is also the validation for the credentials, if they are invalid 401 is
    returned, otherwise the applications are returned as:

    ```json
    {
        "apps": [
            {
                "name":"Sentry Cocoa Sample iOS Swift",
                "bundleId":"io.sentry.sample.iOS-Swift",
                "appId": "1549832463",
            },
            {
                "name":"Sentry React Native Test",
                "bundleId":"io.sentry.react-native-test",
                "appId": "1268541530",
            },
        ]
    }
    ```

    This endpoint returns the applications defined for an account
    It also serves to validate that credentials for App Store connect are valid
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        serializer = AppStoreConnectCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        cfg_id: Optional[str] = data.get("id")
        apc_key: Optional[str] = data.get("appconnectKey")
        apc_private_key: Optional[str] = data.get("appconnectPrivateKey")
        apc_issuer: Optional[str] = data.get("appconnectIssuer")
        if cfg_id:
            try:
                current_config = appconnect.AppStoreConnectConfig.from_project_config(
                    project, cfg_id
                )
            except KeyError:
                return Response(status=404)

            if not apc_key:
                apc_key = current_config.appconnectKey
            if not apc_private_key:
                apc_private_key = current_config.appconnectPrivateKey
            if not apc_issuer:
                apc_issuer = current_config.appconnectIssuer
        if not apc_key or not apc_private_key or not apc_issuer:
            return Response("Incomplete API credentials", status=400)

        credentials = appstore_connect.AppConnectCredentials(
            key_id=apc_key,
            key=apc_private_key,
            issuer_id=apc_issuer,
        )
        session = requests.Session()

        apps = appstore_connect.get_apps(session, credentials)

        if apps is None:
            raise AppConnectAuthenticationError()

        all_apps = [
            {"name": app.name, "bundleId": app.bundle_id, "appId": app.app_id} for app in apps
        ]
        result = {"apps": all_apps}

        return Response(result, status=200)


class CreateSessionContextSerializer(serializers.Serializer):  # type: ignore
    itunes_created = serializers.DateTimeField(required=True)
    client_state = serializers.JSONField(required=True)


class AppStoreCreateCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectCreateCredentialsEndpoint`."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)
    itunesUser = serializers.CharField(max_length=100, min_length=1, required=True)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=True)
    appName = serializers.CharField(max_length=512, min_length=1, required=True)
    appId = serializers.CharField(min_length=1, required=True)
    bundleId = serializers.CharField(min_length=1, required=True)
    orgId = serializers.CharField(max_length=36, min_length=36, required=True)
    orgName = serializers.CharField(max_length=100, required=True)
    sessionContext = CreateSessionContextSerializer(required=True)


class AppStoreConnectCreateCredentialsEndpoint(ProjectEndpoint):  # type: ignore
    """Returns all the App Store Connect symbol source settings ready to be saved.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/``

    See :class:`AppStoreCreateCredentialsSerializer` for the format of the input.  Note that
    the `sessionContext` field must be as returned from a call to
    :class:`AppStoreConnect2FactorAuthEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/`` so you must have gone through
    the iTunes login steps (endpoints 2-4 in module doc string).

    The returned JSON only contains an ``id`` field which can be used in other endpoints to refer
    to this set of credentials.

    The config object is already stored so no further action must be taken by clients once
    they receive the saved configuration.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        serializer = AppStoreCreateCredentialsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        config = serializer.validated_data
        session_context = config.pop("sessionContext")
        try:
            itunes_client = itunes_connect.ITunesClient.from_json(session_context["client_state"])
        except Exception:
            return Response({"session_context": ["Invalid client_state"]}, status=400)

        config["type"] = "appStoreConnect"
        config["id"] = uuid4().hex
        config["name"] = config["appName"]
        config["itunesCreated"] = session_context["itunes_created"]
        config["itunesSession"] = itunes_client.session_cookie()

        # This field is renamed in the backend to represent its actual value, for the UI it
        # is just an opaque value.
        config["orgPublicId"] = config.pop("orgId")

        try:
            validated_config = appconnect.AppStoreConnectConfig.from_json(config)
        except ValueError:
            raise AppConnectMultipleSourcesError
        allow_multiple = features.has(
            MULTIPLE_SOURCES_FEATURE_NAME, project.organization, actor=request.user
        )
        try:
            new_sources = validated_config.update_project_symbol_source(project, allow_multiple)
        except ValueError:
            raise AppConnectMultipleSourcesError

        redacted_sources = redact_source_secrets(new_sources)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_EDIT,
            data={appconnect.SYMBOL_SOURCES_PROP_NAME: redacted_sources},
        )

        dsym_download.apply_async(
            kwargs={
                "project_id": project.id,
                "config_id": validated_config.id,
            }
        )

        return Response({"id": validated_config.id}, status=200)


class UpdateSessionContextSerializer(serializers.Serializer):  # type: ignore
    itunes_created = serializers.DateTimeField(required=True)
    client_state = serializers.JSONField(required=True)


class AppStoreUpdateCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectUpdateCredentialsEndpoint`."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=False)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=False)
    appconnectPrivateKey = SecretField(required=False)
    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = SecretField(required=False)
    appName = serializers.CharField(max_length=512, min_length=1, required=False)
    appId = serializers.CharField(min_length=1, required=False)
    bundleId = serializers.CharField(min_length=1, required=False)
    sessionContext = UpdateSessionContextSerializer(required=False)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.CharField(max_length=36, min_length=36, required=False)
    orgName = serializers.CharField(max_length=100, required=False)

    def validate_appconnectPrivateKey(
        self, private_key_json: Optional[Union[str, Dict[str, bool]]]
    ) -> Optional[json.JSONData]:
        return validate_secret(private_key_json)

    def validate_itunesPassword(
        self, password_json: Optional[Union[str, Dict[str, bool]]]
    ) -> Optional[json.JSONData]:
        return validate_secret(password_json)


class AppStoreConnectUpdateCredentialsEndpoint(ProjectEndpoint):  # type: ignore
    """Updates a subset of the existing credentials.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``

    See :class:`AppStoreUpdateCredentialsSerializer` for the input format.

    This is like :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/`` but allows you to only provide
    a sub-set.  This is most useful when you had to refresh the iTunes session using
    endpoints 2-4 (see module docstring), as you can only supply the `sessionContext`.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project, credentials_id: str) -> Response:
        serializer = AppStoreUpdateCredentialsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        session_context = data.pop("sessionContext")
        try:
            itunes_client = itunes_connect.ITunesClient.from_json(session_context["client_state"])
        except Exception:
            return Response({"session_context": ["Invalid client_state"]}, status=400)

        # get the existing credentials
        try:
            symbol_source_config = appconnect.AppStoreConnectConfig.from_project_config(
                project, credentials_id
            )
        except KeyError:
            return Response(status=404)

        # get the new credentials
        if session_context:
            data["itunesCreated"] = session_context.get("itunes_created")
            data["itunesSession"] = itunes_client.session_cookie()

        if "orgId" in data:
            # This field is renamed in the backend to represent its actual value, for the UI
            # it is just an opaque value.
            data["orgPublicId"] = data.pop("orgId")

        # Any secrets set to None during validation are meant to be no-ops, so remove them to avoid
        # erasing the existing values
        for secret in secret_fields(symbol_source_config.type):
            if secret in data and data[secret] is None:
                del data[secret]

        new_data = symbol_source_config.to_json()
        new_data.update(data)
        symbol_source_config = appconnect.AppStoreConnectConfig.from_json(new_data)

        # We are sure we are only updating, no point in actually checking if multiple are allowed.
        new_sources = symbol_source_config.update_project_symbol_source(
            project, allow_multiple=True
        )

        redacted_sources = redact_source_secrets(new_sources)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_EDIT,
            data={appconnect.SYMBOL_SOURCES_PROP_NAME: redacted_sources},
        )

        dsym_download.apply_async(
            kwargs={
                "project_id": project.id,
                "config_id": symbol_source_config.id,
            }
        )

        return Response(symbol_source_config.to_redacted_json(), status=200)


class AppStoreConnectCredentialsValidateEndpoint(ProjectEndpoint):  # type: ignore
    """Validates both API credentials and if the stored ITunes session is still active.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

    See :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/`` for how to retrieve the ``id``.

    Response:
    ```json
    {
        "appstoreCredentialsValid": true,
        "promptItunesSession": false,
        "pendingDownloads": 123,
        "latestBuildVersion: "9.8.7" | null,
        "latestBuildNumber": "987000" | null,
        "lastCheckedBuilds": "YYYY-MM-DDTHH:MM:SS.SSSSSSZ" | null
    }
    ```

    * ``pendingDownloads`` is the number of pending build dSYM downloads.

    * ``latestBuildVersion`` and ``latestBuildNumber`` together form a unique identifier for
      the latest build recognized by Sentry.

    * ``lastCheckedBuilds`` is when sentry last checked for new builds, regardless
      of whether there were any or no builds in App Store Connect at the time.

    * ``promptItunesSession`` indicates whether the user should be prompted to refresh the
      iTunes session since we know we need to fetch more dSYMs.
    """

    permission_classes = [StrictProjectPermission]

    def get(self, request: Request, project: Project, credentials_id: str) -> Response:
        try:
            symbol_source_cfg = appconnect.AppStoreConnectConfig.from_project_config(
                project, credentials_id
            )
        except KeyError:
            return Response(status=404)

        credentials = appstore_connect.AppConnectCredentials(
            key_id=symbol_source_cfg.appconnectKey,
            key=symbol_source_cfg.appconnectPrivateKey,
            issuer_id=symbol_source_cfg.appconnectIssuer,
        )

        session = requests.Session()
        apps = appstore_connect.get_apps(session, credentials)

        try:
            itunes_client = itunes_connect.ITunesClient.from_session_cookie(
                symbol_source_cfg.itunesSession
            )
            itunes_session_info = itunes_client.request_session_info()
        except itunes_connect.SessionExpiredError:
            itunes_session_info = None

        pending_downloads = AppConnectBuild.objects.filter(project=project, fetched=False).count()

        latest_build = (
            AppConnectBuild.objects.filter(project=project, bundle_id=symbol_source_cfg.bundleId)
            .order_by("-uploaded_to_appstore")
            .first()
        )
        if latest_build is None:
            latestBuildVersion = None
            latestBuildNumber = None
        else:
            latestBuildVersion = latest_build.bundle_short_version
            latestBuildNumber = latest_build.bundle_version

        try:
            check_entry = LatestAppConnectBuildsCheck.objects.get(
                project=project, source_id=symbol_source_cfg.id
            )
        # If the source was only just created then it's possible that sentry hasn't checked for any
        # new builds for it yet.
        except LatestAppConnectBuildsCheck.DoesNotExist:
            last_checked_builds = None
        else:
            last_checked_builds = check_entry.last_checked

        return Response(
            {
                "appstoreCredentialsValid": apps is not None,
                "pendingDownloads": pending_downloads,
                "latestBuildVersion": latestBuildVersion,
                "latestBuildNumber": latestBuildNumber,
                "lastCheckedBuilds": last_checked_builds,
                "promptItunesSession": bool(pending_downloads and itunes_session_info is None),
            },
            status=200,
        )


class AppStoreConnectStartAuthSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectStartAuthEndpoint."""

    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=False)
    id = serializers.CharField(max_length=40, min_length=1, required=False)


class AppStoreConnectStartAuthEndpoint(ProjectEndpoint):  # type: ignore
    """Starts iTunes login sequence.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/start/``

    When creating a brand new session:
    ```json
    {
        "itunesUser": "someone@example.net",
        "itunesPassword": "secret"
    }
    ```
    If you want to refresh an existing session you can use the ``id`` as created by
    :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``) instead:
    ```json
    {
        "id": "xxxx"
    }
    ```

    After calling this the user will be prompted with a 2FA code on their device.  This code
    must be provided using the :class:`AppStoreConnect2FactorAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``).  Alternatively this can be
    followed up with a call to :class:`AppStoreConnectRequestSmsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``) to receive the 2FA
    code via SMS instead.

    In either case both those calls **must** include the ``sessionContext`` as returned by
    the response to this endpoint:

    ```json
    {
        "sessionContext": { ... },
    }
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        if (
            not features.has(
                MULTIPLE_SOURCES_FEATURE_NAME, project.organization, actor=request.user
            )
            and len(appconnect.AppStoreConnectConfig.all_config_ids(project)) > 1
        ):
            raise AppConnectMultipleSourcesError

        serializer = AppStoreConnectStartAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_name = serializer.validated_data.get("itunesUser")
        password = serializer.validated_data.get("itunesPassword")
        credentials_id = serializer.validated_data.get("id")

        if credentials_id is not None:
            try:
                symbol_source_config = appconnect.AppStoreConnectConfig.from_project_config(
                    project, credentials_id
                )
            except KeyError:
                return Response("No credentials found.", status=400)

            user_name = symbol_source_config.itunesUser
            password = symbol_source_config.itunesPassword

        if user_name is None:
            return Response("No user name provided.", status=400)
        if password is None:
            return Response("No password provided.", status=400)

        itunes_client = itunes_connect.ITunesClient()
        try:
            itunes_client.start_login_sequence(user_name, password)
        except itunes_connect.InvalidUsernamePasswordError:
            raise ItunesAuthenticationError
        return Response(
            {"sessionContext": {"client_state": itunes_client.to_json()}},
            status=200,
        )


class RequestSmsSessionContextSerializer(serializers.Serializer):  # type: ignore
    client_state = serializers.JSONField(required=True)


class AppStoreConnectRequestSmsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectRequestSmsEndpoint`."""

    sessionContext = RequestSmsSessionContextSerializer(required=True)


class AppStoreConnectRequestSmsEndpoint(ProjectEndpoint):  # type: ignore
    """Switches an iTunes login to using SMS for 2FA.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``

    You must have called :class:`AppStoreConnectStartAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/start/``) before calling this and
    provide the ``sessionContext`` from that response in the request body:
    ```json
    {
        "sessionContext": { ... }
    }
    ```

    The response will contain a new ``sessionContext`` which must be used in the call to
    :class:`AppStoreConnect2FactorAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``) to complete the login of this
    iTunes session.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data["sessionContext"]
        try:
            itunes_client = itunes_connect.ITunesClient.from_json(data["client_state"])
        except Exception:
            return Response({"session_context": ["Invalid client_state"]}, status=400)

        try:
            itunes_client.request_sms_auth()
        except itunes_connect.SmsBlockedError:
            raise ItunesSmsBlocked
        return Response({"sessionContext": {"client_state": itunes_client.to_json()}}, status=200)


class TwoFactorAuthSessionContextSerializer(serializers.Serializer):  # type: ignore
    client_state = serializers.JSONField(required=True)


class AppStoreConnect2FactorAuthSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnect2FactorAuthEndpoint."""

    sessionContext = TwoFactorAuthSessionContextSerializer(required=True)
    code = serializers.CharField(max_length=10, required=True)


class AppStoreConnect2FactorAuthEndpoint(ProjectEndpoint):  # type: ignore
    """Completes the 2FA iTunes login, returning a valid session.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``

    The request must contain the code provided by the user as well as the ``sessionContext``
    provided by either the :class:`AppStoreConnectStartAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/start/``) call or the
    :class:`AppStoreConnectRequestSmsmEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``) call:
    ```json
    {
        "sessionContext": { ... },
        "code": "324784",
    }
    ```

    If the login was successful this will return:
    ```json
    {
        "sessionContext": { ... },
        "organizations": [
            { "name": "My org", "organizationId": 1234},
            { "name": "Org 2", "organizationId": 4423}
        ]
    }
    ```

    Note that the ``sessionContext`` **is different** from the ones passed in, it must be
    passed to :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``).

    If multiple organisations are returned the user must choose one and this must be
    provided as ``orgId`` and ``OrgName`` in the
    :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``)

    If refreshing a session instead of creating a new one only the ``sessionContext`` needs
    to be updated using :class:`AppStoreConnectUpdateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``).
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        serializer = AppStoreConnect2FactorAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        session_context = data["sessionContext"]
        try:
            itunes_client = itunes_connect.ITunesClient.from_json(session_context["client_state"])
        except Exception:
            return Response({"session_context": ["Invalid client_state"]}, status=400)

        try:
            if itunes_client.state is itunes_connect.ClientState.SMS_AUTH_REQUESTED:
                itunes_client.sms_code(data.get("code"))
            else:
                itunes_client.two_factor_code(data.get("code"))
        except itunes_connect.InvalidAuthCodeError:
            raise ItunesTwoFactorAuthenticationRequired()

        new_session_context = {
            "client_state": itunes_client.to_json(),
            "itunes_created": datetime.datetime.utcnow(),
        }
        all_providers = itunes_client.request_available_providers()
        providers = [{"name": p.name, "organizationId": p.publicProviderId} for p in all_providers]
        return Response(
            {
                "sessionContext": new_session_context,
                "organizations": providers,
            },
            status=200,
        )
