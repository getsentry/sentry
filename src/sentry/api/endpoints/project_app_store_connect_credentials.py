"""Sentry API to manage the App Store Connect credentials for a project.

There are currently two sets of credentials required:
- API credentials
- ITunes credentials

Note that for the ITunes credential Sentry needs to keep a session alive, which typically
lasts 10-14 days.  The UI may need to re-fresh these using endpoints 2-4 at regular
intervals.

To create and manage these credentials, several API endpoints exist:

1. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/apps/``

   This will validate the API credentials and return the list of available applications if
   valid, or 401 if invalid.  See :class:`AppStoreConnectAppsEndpoint`.

2. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/start/``

   This starts an ITunes login, either brand new credentials or re-authenticate an existing
   session.  The user will be prompted with a 2FA code on their device, jump to endpoint 4.
   See :class:`AppStoreConnectStartAuthEndpoint`.

3. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``

   If after endpoint 2 the user wants to receive the 2FA code with SMS instead, call this.
   See :class:`AppStoreConnectRequestSmsmEndpoint`.

4. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``

   Complete the 2FA ITunes authentication stated in endpoint 2 by verifying the 2FA code.
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

   Validate if an existing ITunes session is still active or if a new one needs to be
   initiated by steps 2-4.
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

import requests
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.models import Project
from sentry.utils import fernet_encrypt as encrypt
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect, itunes_connect
from sentry.utils.appleconnect.itunes_connect import ITunesHeaders
from sentry.utils.safe import get_path

# The property name of the project option which contains the encryption key.
#
# This key is what is used to encrypt the secrets before storing them in the project
# options.  Specifically the ``sessionContext``, ``itunesPassword`` and
# ``appconnectPrivateKey`` are currently encrypted using this key.
CREDENTIALS_KEY_NAME = "sentry:appleconnect_key"


# The key in the project options under which all symbol sources are stored.
SYMBOL_SOURCES_PROP_NAME = "sentry:symbol_sources"


# The name of the feature flag which enables the App Store Connect symbol source.
APP_STORE_CONNECT_FEATURE_NAME = "organizations:app-store-connect"

# iTunes session token validity is 10-14 days so we like refreshing after 1 week.
ITUNES_TOKEN_VALIDITY = datetime.timedelta(weeks=1)


def get_app_store_config(
    project: Project, credentials_id: Optional[str]
) -> Optional[json.JSONData]:
    """Returns the appStoreConnect symbol source config for a project."""
    sources_config = project.get_option(SYMBOL_SOURCES_PROP_NAME)

    if credentials_id is None:
        return None
    try:
        sources = json.loads(sources_config)
        for source in sources:
            if (
                source.get("type") == "appStoreConnect"
                and source.get("id") == credentials_id.lower()
            ):
                return source
        return None
    except BaseException as e:
        raise ValueError("bad sources") from e


class AppStoreConnectCredentialsSerializer(serializers.Serializer):
    """Input validation for :class:`AppStoreConnectAppsEndpoint."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)


class AppStoreConnectAppsEndpoint(ProjectEndpoint):
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

    def post(self, request, project):
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
            return Response("App connect authentication error.", status=401)

        apps = [{"name": app.name, "bundleId": app.bundle_id, "appId": app.app_id} for app in apps]
        result = {"apps": apps}

        return Response(result, status=200)


class AppStoreCreateCredentialsSerializer(serializers.Serializer):
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
    appId = serializers.CharField(max_length=512, min_length=1, required=True)
    sessionContext = serializers.CharField(min_length=1, required=True)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=True)
    orgName = serializers.CharField(max_length=100, required=True)


class AppStoreConnectCreateCredentialsEndpoint(ProjectEndpoint):
    """Returns all the App Store Connect symbol source settings ready to be saved.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/``

    See :class:`AppStoreCreateCredentialsSerializer` for the format of the input.  Note that
    the `sessionContext` field must be as returned from a call to
    :class:`AppStoreConnect2FactorAuthEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/`` so you must have gone through
    the ITunes login steps (endpoints 2-4 in module doc string).

    The returned JSON contains an ``id`` field which can be used in other endpoints to refer
    to this set of credentials.

    Credentials as saved using the ``symbolSources`` field under project details page
    (:class:`ProjectDetailsEndpoint` in :file:`src/sentry/api/endpoints/project_details.py`)
    which contains a JSON blob containing all the symbol sources.

    The UI itself is responsible for posting this blob, but this endpoint must be called
    first with the results of authenticating to get the correct JSON format to save.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreCreateCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        key = project.get_option(CREDENTIALS_KEY_NAME)

        if key is None:
            # probably stage 1 login was not called
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

        credentials = serializer.validated_data

        encrypted_context = credentials.pop("sessionContext")

        try:
            validation_context = encrypt.decrypt_object(encrypted_context, key)
            itunes_session = validation_context.get("itunes_session")
            encrypted = {
                "itunesSession": itunes_session,
                "itunesPassword": credentials.get("itunesPassword"),
                "appconnectPrivateKey": credentials.get("appconnectPrivateKey"),
            }
            credentials["encrypted"] = encrypt.encrypt_object(encrypted, key)
            credentials["type"] = "appStoreConnect"
            credentials["refreshDate"] = datetime.utcnow()
            credentials["id"] = uuid4().hex
            credentials["name"] = "Apple App Store Connect"

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
        return Response(credentials, status=200)


class AppStoreUpdateCredentialsSerializer(serializers.Serializer):
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
    appId = serializers.CharField(max_length=512, min_length=1, required=False)
    sessionContext = serializers.CharField(min_length=1, required=False)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=False)
    orgName = serializers.CharField(max_length=100, required=False)


class AppStoreConnectUpdateCredentialsEndpoint(ProjectEndpoint):
    """Updates a subset of the existing credentials.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``

    See :class:`AppStoreUpdateCredentialsSerializer` for the input format.

    This is like :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/`` but allows you to only provide
    a sub-set.  This is most useful when you had to refresh the ITunes session using
    endpoints 2-4 (see module docstring), as you can only supply the `sessionContext`.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project, credentials_id):
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreUpdateCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # get the existing credentials
        credentials = get_app_store_config(project, credentials_id)
        key = project.get_option(CREDENTIALS_KEY_NAME)

        if key is None or credentials is None:
            return Response(status=404)

        try:
            secrets = encrypt.decrypt_object(credentials.pop("encrypted"), key)
        except ValueError:
            return Response(status=500)

        # get the new credentials
        new_credentials = serializer.validated_data
        encrypted_context = new_credentials.get("sessionContext")

        new_itunes_session = None
        if encrypted_context is not None:
            try:
                validation_context = encrypt.decrypt_object(encrypted_context, key)
                new_itunes_session = validation_context.get("itunes_session")
            except ValueError:
                return Response("Invalid validation context passed.", status=400)

        new_secrets = {}

        if new_itunes_session is not None:
            new_secrets["itunesSession"] = new_itunes_session

        new_itunes_password = new_credentials.get("itunesPassword")
        if new_itunes_password is not None:
            new_secrets["itunesPassword"] = new_itunes_password

        new_appconnect_private_key = new_credentials.get("appconnectPrivateKey")
        if new_appconnect_private_key is not None:
            new_secrets["appconnectPrivateKey"] = new_appconnect_private_key

        # merge the new and existing credentials

        try:
            secrets.update(new_secrets)
            credentials.update(new_credentials)

            credentials["encrypted"] = encrypt.encrypt_object(secrets, key)
            credentials["refreshDate"] = datetime.utcnow()
            credentials["id"] = uuid4().hex

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
        return Response(credentials, status=200)


class AppStoreConnectCredentialsValidateEndpoint(ProjectEndpoint):
    """Validates both API credentials and if the stored ITunes session is still active.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

    See :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/`` for how to retrieve the ``id``.

    Response:
    ```json
    {
        "appstoreCredentialsValid": true,
        "itunesSessionValid": true,
        "expirationDate": "YYYY-MM-DDTHH:MM:SS.SSSZ" | null
    }
    ```
    """

    permission_classes = [StrictProjectPermission]

    def get(self, request, project, credentials_id):
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        symbol_source_cfg = get_app_store_config(project, credentials_id)
        key = project.get_option(CREDENTIALS_KEY_NAME)

        if key is None or symbol_source_cfg is None:
            return Response(status=404)

        if symbol_source_cfg.get("refreshDate") is not None:
            expiration_date = (
                datetime.datetime.fromisoformat(symbol_source_cfg.get("refreshDate"))
                + ITUNES_TOKEN_VALIDITY
            )
        else:
            expiration_date = None

        try:
            secrets = encrypt.decrypt_object(symbol_source_cfg.get("encrypted"), key)
        except ValueError:
            return Response(status=500)

        credentials = appstore_connect.AppConnectCredentials(
            key_id=symbol_source_cfg.get("appconnectKey"),
            key=secrets.get("appconnectPrivateKey"),
            issuer_id=symbol_source_cfg.get("appconnectIssuer"),
        )

        session = requests.Session()
        apps = appstore_connect.get_apps(session, credentials)

        appstore_valid = apps is not None
        itunes_connect.load_session_cookie(session, secrets.get("itunesSession"))
        itunes_session_info = itunes_connect.get_session_info(session)

        itunes_session_valid = itunes_session_info is not None

        return Response(
            {
                "appstoreCredentialsValid": appstore_valid,
                "itunesSessionValid": itunes_session_valid,
                "expirationDate": expiration_date,
            },
            status=200,
        )


class AppStoreConnectStartAuthSerializer(serializers.Serializer):
    """Input validation for :class:`AppStoreConnectStartAuthEndpoint."""

    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=False)
    id = serializers.CharField(max_length=40, min_length=1, required=False)


class AppStoreConnectStartAuthEndpoint(ProjectEndpoint):
    """Starts ITunes login sequence.

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
        "sessionContext": "xxxx"
    }
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
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

        key = project.get_option(CREDENTIALS_KEY_NAME)

        if key is None:
            # no encryption key for this project, create one
            key = encrypt.create_key()
            project.update_option(CREDENTIALS_KEY_NAME, key)
        else:
            # we have an encryption key, see if the credentials were not
            # supplied and we just want to re validate the session
            if user_name is None or password is None:
                # credentials not supplied use saved credentials

                credentials = get_app_store_config(project, credentials_id)
                if key is None or credentials is None:
                    return Response("No credentials provided.", status=400)

                try:
                    secrets = encrypt.decrypt_object(credentials.get("encrypted"), key)
                except ValueError:
                    return Response("Invalid credentials state.", status=500)

                user_name = credentials.get("itunesUser")
                password = secrets.get("itunesPassword")

                if user_name is None or password is None:
                    return Response("Invalid credentials.", status=500)

        session = requests.session()

        auth_key = itunes_connect.get_auth_service_key(session)

        if auth_key is None:
            return Response("Could not contact itunes store.", status=500)

        if user_name is None:
            return Response("No user name provided.", status=400)
        if password is None:
            return Response("No password provided.", status=400)

        init_login_result = itunes_connect.initiate_login(
            session, service_key=auth_key, account_name=user_name, password=password
        )
        if init_login_result is None:
            return Response("ITunes login failed.", status=401)

        # send session context to be used in next calls
        session_context = {
            "auth_key": auth_key,
            "session_id": init_login_result.session_id,
            "scnt": init_login_result.scnt,
        }

        return Response(
            {"sessionContext": encrypt.encrypt_object(session_context, key)}, status=200
        )


class AppStoreConnectRequestSmsSerializer(serializers.Serializer):
    """Input validation for :class:`AppStoreConnectRequestSmsEndpoint`."""

    sessionContext = serializers.CharField(min_length=1, required=True)


class AppStoreConnectRequestSmsEndpoint(ProjectEndpoint):
    """Switches an ITunes login to using SMS for 2FA.

    You must have called :class:`AppStoreConnectStartAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/start/``) before calling this and
    provide the ``sessionContext`` from that response in the request body:
    ```json
    {
        "sessionContext": "xxxx"
    }
    ```

    The response will contain a new ``sessionContext`` which must be used in the call to
    :class:`AppStoreConnect2FactorAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/2fa/``) to complete the login of this
    ITunes session.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        session = requests.Session()

        encrypted_context = serializer.validated_data.get("sessionContext")
        key = project.get_option(CREDENTIALS_KEY_NAME)

        if key is None:
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

        try:
            # recover the headers set in the first step authentication
            session_context = encrypt.decrypt_object(encrypted_context, key)
            headers = ITunesHeaders(
                session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
            )
            auth_key = session_context.get("auth_key")

        except ValueError:
            return Response("Invalid validation context passed.", status=400)

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

        if init_phone_login is None:
            return Response("Phone 2fa failed", status=500)

        # success, return the new session context (add phone_id and push mode to the session context)
        session_context["phone_id"] = phone_info.id
        session_context["push_mode"] = phone_info.push_mode
        encrypted_context = encrypt.encrypt_object(session_context, key)
        return Response({"sessionContext": encrypted_context}, status=200)


class AppStoreConnect2FactorAuthSerializer(serializers.Serializer):
    """Input validation for :class:`AppStoreConnect2FactorAuthEndpoint."""

    code = serializers.CharField(max_length=10, required=True)
    useSms = serializers.BooleanField(required=True)
    sessionContext = serializers.CharField(min_length=1, required=True)


class AppStoreConnect2FactorAuthEndpoint(ProjectEndpoint):
    """Completes the 2FA ITunes login, returning a valid session.

    The request most contain the code provided by the user as well as the ``sessionContext``
    provided by either the :class:`AppStoreConnectStartAuthEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/start/``) call or the
    :class:`AppStoreConnectRequestSmsmEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/requestSms/``) call:
    ```json
    {
        "code": "324784",
        "useSms": false,
        "sessionContext": "xxxx",
    }
    ```

    If the login was successful this will return:
    ```json
    {
        "sessionContext": "xxxx",
        "organizations": [
            { "name": "My org", "organizationId": 1234},
            { "name": "Org 2", "organizationId": 4423}
        ]
    }
    ```

    Note that the ``sessionContext`` **is different** from the one passed in, it must be
    passed to :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``).

    If multiple organisations are returned the user must choose one and this must be
    provided as ``orgId`` and ``OrgName`` in the
    :class:`AppStoreConnectCreateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/``)

    If refreshing a session instead of creating a new one only the ``sessionContext`` needs
    to be updated uinsg :class:`AppStoreConnectUpdateCredentialsEndpoint`
    (``projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``).
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            APP_STORE_CONNECT_FEATURE_NAME, project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnect2FactorAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        encrypted_context = serializer.validated_data.get("sessionContext")
        key = project.get_option(CREDENTIALS_KEY_NAME)
        use_sms = serializer.validated_data.get("useSms")
        code = serializer.validated_data.get("code")

        if key is None:
            # probably stage 1 login was not called
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

        try:
            # recover the headers set in the first step authentication
            session_context = encrypt.decrypt_object(encrypted_context, key)
            headers = ITunesHeaders(
                session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
            )
            auth_key = session_context.get("auth_key")

            session = requests.Session()

            if use_sms:
                phone_id = session_context.get("phone_id")
                push_mode = session_context.get("push_mode")
                success = itunes_connect.send_phone_authentication_confirmation_code(
                    session,
                    service_key=auth_key,
                    headers=headers,
                    phone_id=phone_id,
                    push_mode=push_mode,
                    security_code=code,
                )
            else:
                success = itunes_connect.send_authentication_confirmation_code(
                    session, service_key=auth_key, headers=headers, security_code=code
                )

            if success:
                session_info = itunes_connect.get_session_info(session)

                if session_info is None:
                    return Response("session info failed", status=500)

                existing_providers = get_path(session_info, "availableProviders")
                providers = [
                    {"name": provider.get("name"), "organizationId": provider.get("providerId")}
                    for provider in existing_providers
                ]
                prs_id = get_path(session_info, "user", "prsId")

                itunes_session = itunes_connect.get_session_cookie(session)
                session_context = {
                    "auth_key": auth_key,
                    "session_id": headers.session_id,
                    "scnt": headers.scnt,
                    "itunes_session": itunes_session,
                    "itunes_person_id": prs_id,
                }
                encrypted_context = encrypt.encrypt_object(session_context, key)

                response_body = {"sessionContext": encrypted_context, "organizations": providers}

                return Response(response_body, status=200)
            else:
                return Response("2FA failed.", status=401)

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
