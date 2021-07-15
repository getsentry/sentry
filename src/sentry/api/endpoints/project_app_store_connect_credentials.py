"""Sentry API to manage the App Store Connect credentials for a project.

There are currently two sets of credentials required:
- API credentials
- iTunes credentials

Note that for the iTunes credential Sentry needs to keep a session alive, which typically
lasts 10-14 days.  The UI may need to re-fresh these using endpoints 2-4 at regular
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
from uuid import uuid4

import requests
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.api.exceptions import (
    AppConnectAuthenticationError,
    ItunesAuthenticationError,
    ItunesTwoFactorAuthenticationRequired,
)
from sentry.lang.native import appconnect
from sentry.models import AppConnectBuild, AuditLogEntryEvent, Project
from sentry.tasks.app_store_connect import dsym_download
from sentry.utils.appleconnect import appstore_connect, itunes_connect
from sentry.utils.appleconnect.itunes_connect import ITunesHeaders
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


# The name of the feature flag which enables the App Store Connect symbol source.
APP_STORE_CONNECT_FEATURE_NAME = "organizations:app-store-connect"

# iTunes session token validity is 10-14 days so we like refreshing after 1 week.
ITUNES_TOKEN_VALIDITY = datetime.timedelta(weeks=1)


class AppStoreConnectCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectAppsEndpoint."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)


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
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        credentials = appstore_connect.AppConnectCredentials(
            key_id=data.get("appconnectKey"),
            key=data.get("appconnectPrivateKey"),
            issuer_id=data.get("appconnectIssuer"),
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
    auth_key = serializers.CharField(min_length=1, required=True)
    session_id = serializers.CharField(min_length=1, required=True)
    scnt = serializers.CharField(min_length=1, required=True)
    itunes_session = serializers.CharField(min_length=1, required=True)
    itunes_person_id = serializers.CharField(min_length=1, required=True)
    itunes_created = serializers.DateTimeField(required=True)


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
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=True)
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

    The returned JSON contains an ``id`` field which can be used in other endpoints to refer
    to this set of credentials.

    Credentials as saved using the ``symbolSources`` field under project details page
    (:class:`ProjectDetailsEndpoint` in :file:`src/sentry/api/endpoints/project_details.py`)
    which contains a JSON blob containing all the symbol sources.

    The UI itself is responsible for posting this blob, but this endpoint must be called
    first with the results of authenticating to get the correct JSON format to save.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project) -> Response:
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreCreateCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        config = serializer.validated_data
        session_context = config.pop("sessionContext")

        config["type"] = "appStoreConnect"
        config["id"] = uuid4().hex
        config["name"] = "Apple App Store Connect"
        config["itunesCreated"] = session_context.get("itunes_created")
        config["itunesSession"] = session_context.get("itunes_session")
        config["itunesPersonId"] = session_context.get("itunes_person_id")

        validated_config = appconnect.AppStoreConnectConfig.from_json(config)
        new_sources = validated_config.update_project_symbol_source(project)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_EDIT,
            data={appconnect.SYMBOL_SOURCES_PROP_NAME: new_sources},
        )

        dsym_download.apply_async(
            kwargs={
                "project_id": project.id,
                "config_id": validated_config.id,
            }
        )

        return Response(config, status=200)


class UpdateSessionContextSerializer(serializers.Serializer):  # type: ignore
    auth_key = serializers.CharField(min_length=1, required=True)
    session_id = serializers.CharField(min_length=1, required=True)
    scnt = serializers.CharField(min_length=1, required=True)
    itunes_session = serializers.CharField(min_length=1, required=True)
    itunes_person_id = serializers.CharField(min_length=1, required=True)
    itunes_created = serializers.DateTimeField(required=True)


class AppStoreUpdateCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectUpdateCredentialsEndpoint`."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=False)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=False)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=False)
    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=False)
    appName = serializers.CharField(max_length=512, min_length=1, required=False)
    appId = serializers.CharField(min_length=1, required=False)
    bundleId = serializers.CharField(min_length=1, required=False)
    sessionContext = UpdateSessionContextSerializer(required=False)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=False)
    orgName = serializers.CharField(max_length=100, required=False)


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
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreUpdateCredentialsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # get the existing credentials
        try:
            symbol_source_config = appconnect.AppStoreConnectConfig.from_project_config(
                project, credentials_id
            )
        except KeyError:
            return Response(status=404)

        # get the new credentials
        data = serializer.validated_data
        session_context = data.pop("sessionContext")

        if session_context:
            data["itunesCreated"] = session_context.get("itunes_created")
            data["itunesSession"] = session_context.get("itunes_session")
            data["itunesPersonId"] = session_context.get("itunes_person_id")

        new_data = symbol_source_config.to_json()
        new_data.update(data)
        symbol_source_config = appconnect.AppStoreConnectConfig.from_json(new_data)
        new_sources = symbol_source_config.update_project_symbol_source(project)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_EDIT,
            data={appconnect.SYMBOL_SOURCES_PROP_NAME: new_sources},
        )

        dsym_download.apply_async(
            kwargs={
                "project_id": project.id,
                "config_id": symbol_source_config.id,
            }
        )

        return Response(symbol_source_config.to_json(), status=200)


class AppStoreConnectCredentialsValidateEndpoint(ProjectEndpoint):  # type: ignore
    """Validates both API credentials and if the stored ITunes session is still active.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

    See :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/`` for how to retrieve the ``id``.

    Response:
    ```json
    {
        "appstoreCredentialsValid": true,
        "itunesSessionValid": true,
        "pendingDownloads": 123,
        "itunesSessionRefreshAt": "YYYY-MM-DDTHH:MM:SS.SSSSSSZ" | null
    }
    ```

    Here the ``itunesSessionRefreshAt`` is when we recommend to refresh the
    iTunes session, and ``pendingDownloads`` is the number of pending downloads,
    and an indicator if we do need the session to fetch new builds.
    """

    permission_classes = [StrictProjectPermission]

    def get(self, request: Request, project: Project, credentials_id: str) -> Response:
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        try:
            symbol_source_cfg = appconnect.AppStoreConnectConfig.from_project_config(
                project, credentials_id
            )
        except KeyError:
            return Response(status=404)

        expiration_date = symbol_source_cfg.itunesCreated + ITUNES_TOKEN_VALIDITY

        credentials = appstore_connect.AppConnectCredentials(
            key_id=symbol_source_cfg.appconnectKey,
            key=symbol_source_cfg.appconnectPrivateKey,
            issuer_id=symbol_source_cfg.appconnectIssuer,
        )

        session = requests.Session()
        apps = appstore_connect.get_apps(session, credentials)

        itunes_connect.load_session_cookie(session, symbol_source_cfg.itunesSession)
        itunes_session_info = itunes_connect.get_session_info(session)

        pending_downloads = AppConnectBuild.objects.filter(project=project, fetched=False).count()

        return Response(
            {
                "appstoreCredentialsValid": apps is not None,
                "itunesSessionValid": itunes_session_info is not None,
                "itunesSessionRefreshAt": expiration_date if itunes_session_info else None,
                "pendingDownloads": pending_downloads,
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
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

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

        session = requests.session()

        auth_key = itunes_connect.get_auth_service_key(session)

        init_login_result = itunes_connect.initiate_login(
            session, service_key=auth_key, account_name=user_name, password=password
        )
        if init_login_result is None:
            raise ItunesAuthenticationError()

        return Response(
            {
                "sessionContext": {
                    "auth_key": auth_key,
                    "session_id": init_login_result.session_id,
                    "scnt": init_login_result.scnt,
                }
            },
            status=200,
        )


class RequestSmsSessionContextSerializer(serializers.Serializer):  # type: ignore
    auth_key = serializers.CharField(min_length=1, required=True)
    session_id = serializers.CharField(min_length=1, required=True)
    scnt = serializers.CharField(min_length=1, required=True)


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
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data["sessionContext"]

        headers = ITunesHeaders(session_id=data.get("session_id"), scnt=data.get("scnt"))
        auth_key = data.get("auth_key")

        session = requests.Session()

        phone_info = itunes_connect.get_trusted_phone_info(
            session, service_key=auth_key, headers=headers
        )
        if phone_info is None:
            return Response("Could not get phone info", status=400)

        init_phone_login = itunes_connect.initiate_phone_login(
            session,
            service_key=auth_key,
            headers=headers,
            phone_id=phone_info.id,
            push_mode=phone_info.push_mode,
        )
        if not init_phone_login:
            return Response("Phone 2fa failed", status=500)

        # success, return the new session context (add phone_id and push mode to the session context)
        data["phone_id"] = phone_info.id
        data["push_mode"] = phone_info.push_mode
        return Response({"sessionContext": data}, status=200)


class TwoFactorAuthSessionContextSerializer(serializers.Serializer):  # type: ignore
    auth_key = serializers.CharField(min_length=1, required=True)
    session_id = serializers.CharField(min_length=1, required=True)
    scnt = serializers.CharField(min_length=1, required=True)
    phone_id = serializers.CharField(min_length=1, required=False)
    push_mode = serializers.CharField(min_length=1, required=False)


class AppStoreConnect2FactorAuthSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnect2FactorAuthEndpoint."""

    sessionContext = TwoFactorAuthSessionContextSerializer(required=True)
    code = serializers.CharField(max_length=10, required=True)
    useSms = serializers.BooleanField(required=True)


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
        "useSms": false,  # or true if requestSms was called,
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
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnect2FactorAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        session_context = data["sessionContext"]

        session = requests.Session()
        headers = ITunesHeaders(
            session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
        )

        if data.get("useSms"):
            success = itunes_connect.send_phone_authentication_confirmation_code(
                session,
                service_key=session_context.get("auth_key"),
                headers=headers,
                phone_id=session_context.get("phone_id"),
                push_mode=session_context.get("push_mode"),
                security_code=data.get("code"),
            )
        else:
            success = itunes_connect.send_authentication_confirmation_code(
                session,
                service_key=session_context.get("auth_key"),
                headers=headers,
                security_code=data.get("code"),
            )
        if success:
            session_info = itunes_connect.get_session_info(session)
            if session_info is None:
                return Response("Session info failed.", status=500)

            existing_providers = get_path(session_info, "availableProviders")
            providers = [
                {"name": provider.get("name"), "organizationId": provider.get("providerId")}
                for provider in existing_providers
            ]
            prs_id = get_path(session_info, "user", "prsId")

            itunes_session = itunes_connect.get_session_cookie(session)
            new_session_context = {
                "auth_key": session_context.get("auth_key"),
                "session_id": headers.session_id,
                "scnt": headers.scnt,
                "itunes_session": itunes_session,
                "itunes_person_id": prs_id,
                "itunes_created": datetime.datetime.utcnow(),
            }
            return Response(
                {
                    "sessionContext": new_session_context,
                    "organizations": providers,
                },
                status=200,
            )
        else:
            raise ItunesTwoFactorAuthenticationRequired()
