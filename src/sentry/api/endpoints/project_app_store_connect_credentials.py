"""Sentry API to manage the App Store Connect credentials for a project.

To create and manage these credentials, several API endpoints exist:

Creation:
    1. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/apps/``

    This will validate the API credentials and return the list of available applications if
    valid, or 401 if invalid.  See :class:`AppStoreConnectAppsEndpoint`.

    2. ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/``

    Finalise authentication and returns full ``symbolSource`` settings to be saved in
    the project details.  This includes an ``id`` which identifies this set of credentials
    which can be used in other endpoints. See :class:`AppStoreConnectCreateCredentialsEndpoint`.

Updating:
    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``

    Update a subset of the full credentials. Returns the entire symbol source JSON config to be
    saved in project details.  See :class:`AppStoreConnectUpdateCredentialsEndpoint`.

Status checks:
    ``GET projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

    Returns useful info on the status of a connected app's builds and debug file downloads. Also
    validates and includes the status of API credentials associated with this app.
    See :class:`AppStoreConnectCredentialsValidateEndpoint`.
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
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission, StrictProjectPermission
from sentry.api.exceptions import AppConnectAuthenticationError, AppConnectMultipleSourcesError
from sentry.api.fields.secret import SecretField, validate_secret
from sentry.lang.native import appconnect
from sentry.lang.native.symbolicator import redact_source_secrets, secret_fields
from sentry.models import AppConnectBuild, AuditLogEntryEvent, LatestAppConnectBuildsCheck, Project
from sentry.tasks.app_store_connect import dsym_download
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect

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


class AppStoreCreateCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectCreateCredentialsEndpoint`."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)
    appName = serializers.CharField(max_length=512, min_length=1, required=True)
    appId = serializers.CharField(min_length=1, required=True)
    bundleId = serializers.CharField(min_length=1, required=True)


class AppStoreConnectCreateCredentialsEndpoint(ProjectEndpoint):  # type: ignore
    """Returns all the App Store Connect symbol source settings ready to be saved.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/``

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

        config["type"] = "appStoreConnect"
        config["id"] = uuid4().hex
        config["name"] = config["appName"]

        # TODO(itunes): Deprecated fields. Needs to be removed alongside a migration, so this uses
        # placeholders as a temporary workaround until that migration happens.
        config["itunesCreated"] = datetime.datetime.now()
        config["itunesSession"] = "deprecated-field-do-not-use"
        config["orgPublicId"] = "deprecated-field-please-do-not-use--"
        config["orgName"] = "deprecated-field-do-not-use"
        config["itunesUser"] = "deprecated-field-do-not-use"
        config["itunesPassword"] = "deprecated-field-do-not-use"

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


class AppStoreUpdateCredentialsSerializer(serializers.Serializer):  # type: ignore
    """Input validation for :class:`AppStoreConnectUpdateCredentialsEndpoint`."""

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=False)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=False)
    appconnectPrivateKey = SecretField(required=False)
    appName = serializers.CharField(max_length=512, min_length=1, required=False)
    appId = serializers.CharField(min_length=1, required=False)
    bundleId = serializers.CharField(min_length=1, required=False)

    def validate_appconnectPrivateKey(
        self, private_key_json: Optional[Union[str, Dict[str, bool]]]
    ) -> Optional[json.JSONData]:
        return validate_secret(private_key_json)


class AppStoreConnectUpdateCredentialsEndpoint(ProjectEndpoint):  # type: ignore
    """Updates a subset of the existing credentials.

    ``POST projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/``

    See :class:`AppStoreUpdateCredentialsSerializer` for the input format.

    This is like :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/{id}/`` but allows you to only provide
    a sub-set. Useful for API key refreshes.
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request: Request, project: Project, credentials_id: str) -> Response:
        serializer = AppStoreUpdateCredentialsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        try:
            symbol_source_config = appconnect.AppStoreConnectConfig.from_project_config(
                project, credentials_id
            )
        except KeyError:
            return Response(status=404)

        # Deprecated fields. Needs to be removed alongside a migration, so this uses
        # placeholders as a temporary workaround until that migration happens.
        data["itunesCreated"] = datetime.datetime.now()
        data["itunesSession"] = "deprecated-field-do-not-use"
        data["orgPublicId"] = "deprecated-field-please-do-not-use--"
        data["orgName"] = "deprecated-field-do-not-use"
        data["itunesUser"] = "deprecated-field-do-not-use"
        data["itunesPassword"] = "deprecated-field-do-not-use"

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
    """Validates the project's App Store Connect API credentials.

    ``GET projects/{org_slug}/{proj_slug}/appstoreconnect/validate/{id}/``

    See :class:`AppStoreConnectCreateCredentialsEndpoint` aka
    ``projects/{org_slug}/{proj_slug}/appstoreconnect/`` for how to retrieve the ``id``.

    Response:
    ```json
    {
        "appstoreCredentialsValid": true,
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
    """

    permission_classes = [ProjectPermission]

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
            },
            status=200,
        )


class AppStoreConnectStatusEndpoint(ProjectEndpoint):  # type: ignore
    """Returns a summary of the project's App Store Connect configuration
    and builds.

    ``GET projects/{org_slug}/{proj_slug}/appstoreconnect/status``

    Response:
    ```json
    [
        {
            "id": "abc123",
            "appstoreCredentialsValid": true,
            "pendingDownloads": 123,
            "latestBuildVersion: "9.8.7" | null,
            "latestBuildNumber": "987000" | null,
            "lastCheckedBuilds": "YYYY-MM-DDTHH:MM:SS.SSSSSSZ" | null
        }
        {
            "id": ...,
            "appstoreCredentialsValid": ...,
            "pendingDownloads": ...,
            "latestBuildVersion: ...,
            "latestBuildNumber": ...,
            "lastCheckedBuilds": ...
        },
        ...
    ]
    ```

    * ``pendingDownloads`` is the number of pending build dSYM downloads.

    * ``latestBuildVersion`` and ``latestBuildNumber`` together form a unique identifier for
      the latest build recognized by Sentry.

    * ``lastCheckedBuilds`` is when sentry last checked for new builds, regardless
      of whether there were any or no builds in App Store Connect at the time.
    """

    permission_classes = [ProjectPermission]

    def get(self, request: Request, project: Project) -> Response:
        config_ids = appconnect.AppStoreConnectConfig.all_config_ids(project)
        statuses = []
        for config_id in config_ids:
            try:
                symbol_source_cfg = appconnect.AppStoreConnectConfig.from_project_config(
                    project, config_id
                )
            except KeyError:
                continue

            credentials = appstore_connect.AppConnectCredentials(
                key_id=symbol_source_cfg.appconnectKey,
                key=symbol_source_cfg.appconnectPrivateKey,
                issuer_id=symbol_source_cfg.appconnectIssuer,
            )

            session = requests.Session()

            apps = appstore_connect.get_apps(session, credentials)

            pending_downloads = AppConnectBuild.objects.filter(
                project=project, fetched=False
            ).count()

            latest_build = (
                AppConnectBuild.objects.filter(
                    project=project, bundle_id=symbol_source_cfg.bundleId
                )
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

            statuses.append(
                {
                    "id": config_id,
                    "appstoreCredentialsValid": apps is not None,
                    "pendingDownloads": pending_downloads,
                    "latestBuildVersion": latestBuildVersion,
                    "latestBuildNumber": latestBuildNumber,
                    "lastCheckedBuilds": last_checked_builds,
                }
            )

        return Response(statuses, status=200)
