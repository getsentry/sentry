"""Integration of native symbolication with Apple App Store Connect.

Sentry can download dSYMs directly from App Store Connect, this is the support code for
this.
"""

import dataclasses
import logging
import pathlib
from datetime import datetime
from typing import Any, Dict, List

import dateutil
import jsonschema
import requests
import sentry_sdk
from django.db import transaction

from sentry.lang.native.symbolicator import APP_STORE_CONNECT_SCHEMA, secret_fields
from sentry.models import Project
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect, itunes_connect

logger = logging.getLogger(__name__)

# This might be odd, but it convinces mypy that this is part of this module's API.
BuildInfo = appstore_connect.BuildInfo
NoDsymUrl = appstore_connect.NoDsymUrl
PublicProviderId = itunes_connect.PublicProviderId


# The key in the project options under which all symbol sources are stored.
SYMBOL_SOURCES_PROP_NAME = "sentry:symbol_sources"

# The symbol source type for an App Store Connect symbol source.
SYMBOL_SOURCE_TYPE_NAME = "appStoreConnect"


class InvalidConfigError(Exception):
    """Invalid configuration for the appStoreConnect symbol source."""

    pass


class PendingDsymsError(Exception):
    """dSYM url is currently unavailable."""

    pass


class NoDsymsError(Exception):
    """No dSYMs were found."""

    pass


@dataclasses.dataclass(frozen=True)
class AppStoreConnectConfig:
    """The symbol source configuration for an App Store Connect source.

    This is stored as a symbol source inside symbolSources project option.
    """

    # The type of symbol source, can only be `appStoreConnect`.
    type: str

    # The ID which identifies this symbol source for this project.
    id: str

    # The name of the symbol source.
    #
    # Currently users can not chose this name, but it has a name anyway.
    name: str

    # Issuer ID for the API credentials.
    appconnectIssuer: str

    # Key ID for the API credentials.
    appconnectKey: str

    # Private key for the API credentials.
    appconnectPrivateKey: str

    # Username for the iTunes credentials.
    itunesUser: str

    # Password for the iTunes credentials.
    itunesPassword: str

    # The iTunes session cookie.
    #
    # Loading this cookie into ``requests.Session`` (see
    # ``sentry.utils.appleconnect.itunes_connect.load_session_cookie``) will allow this
    # session to make API iTunes requests as the user.
    itunesSession: str

    # The time the ``itunesSession`` cookie was created.
    #
    # The cookie only has a valid session for a limited time and needs user-interaction to
    # create it.  So we keep track of when it was created.
    itunesCreated: datetime

    # The name of the application, as supplied by the App Store Connect API.
    appName: str

    # The ID of the application in the App Store Connect API.
    #
    # We presume this is stable until proven otherwise.
    appId: str

    # The bundleID, e.g. io.sentry.sample.iOS-Swift.
    #
    # This is guaranteed to be unique and should map 1:1 to ``appId``.
    bundleId: str

    # The publicProviderId of the organisation according to iTunes.
    #
    # An iTunes session can have multiple organisations and needs this ID to be able to
    # select the correct organisation to operate on.
    orgPublicId: PublicProviderId

    # The name of an organisation, as supplied by iTunes.
    orgName: str

    def __post_init__(self) -> None:
        # All fields are required.
        for field in dataclasses.fields(self):
            if not getattr(self, field.name, None):
                raise ValueError(f"Missing field: {field.name}")

    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> "AppStoreConnectConfig":
        """Creates a new instance from **deserialised** JSON data.

        This will include the JSON schema validation.  It accepts both a str or a datetime
        for the ``itunesCreated``.  Thus you can safely use this to create and validate the
        config as deserialised by both plain JSON deserialiser or by Django Rest Framework's
        deserialiser.

        :raises InvalidConfigError: if the data does not contain a valid App Store Connect
           symbol source configuration.
        """
        if isinstance(data["itunesCreated"], datetime):
            data["itunesCreated"] = data["itunesCreated"].isoformat()
        try:
            jsonschema.validate(data, APP_STORE_CONNECT_SCHEMA)
        except jsonschema.exceptions.ValidationError as e:
            raise InvalidConfigError from e
        data["itunesCreated"] = dateutil.parser.isoparse(data["itunesCreated"])
        return cls(**data)

    @classmethod
    def from_project_config(cls, project: Project, config_id: str) -> "AppStoreConnectConfig":
        """Creates a new instance from the symbol source configured in the project.

        :raises KeyError: if the config is not found.
        :raises InvalidConfigError if the stored config is somehow invalid.
        """
        raw = project.get_option(SYMBOL_SOURCES_PROP_NAME)

        # UI bug: the UI writes an empty string when removing the last symbol source from
        # the list.  So we need to cater for both `None` and `''` being returned from
        # .get_option().
        if not raw:
            raw = "[]"

        all_sources = json.loads(raw)
        for source in all_sources:
            if source.get("type") == SYMBOL_SOURCE_TYPE_NAME and (source.get("id") == config_id):
                return cls.from_json(source)
        else:
            raise KeyError(f"No {SYMBOL_SOURCE_TYPE_NAME} symbol source found with id {config_id}")

    @staticmethod
    def all_config_ids(project: Project) -> List[str]:
        """Return the config IDs of all appStoreConnect symbol sources configured in the project."""
        raw = project.get_option(SYMBOL_SOURCES_PROP_NAME)
        if not raw:
            raw = "[]"
        all_sources = json.loads(raw)
        return [
            s.get("id")
            for s in all_sources
            if s.get("type") == SYMBOL_SOURCE_TYPE_NAME and s.get("id")
        ]

    def to_json(self) -> Dict[str, Any]:
        """Creates a dict which can be serialised to JSON. This dict should only be
        used internally and should never be sent to external clients, as it contains
        the raw content of all of the secrets contained in the config.

        The generated dict will be validated according to the schema.

        :raises InvalidConfigError: if somehow the data in the class is not valid, this
           should only occur if the class was created in a weird way.
        """
        data = dict()
        for field in dataclasses.fields(self):
            value = getattr(self, field.name)
            if field.name == "itunesCreated":
                value = value.isoformat()
            data[field.name] = value
        try:
            jsonschema.validate(data, APP_STORE_CONNECT_SCHEMA)
        except jsonschema.exceptions.ValidationError as e:
            raise InvalidConfigError from e
        return data

    def to_redacted_json(self) -> Dict[str, Any]:
        """Creates a dict which can be serialised to JSON. This should be used when the
        config is meant to be passed to some external consumer, like the front end client.
        This dict will have its secrets redacted.

        :raises InvalidConfigError: if somehow the data in the class is not valid, this
           should only occur if the class was created in a weird way.
        """
        data = self.to_json()
        for to_redact in secret_fields("appStoreConnect"):
            data[to_redact] = {"hidden-secret": True}
        return data

    def update_project_symbol_source(self, project: Project, allow_multiple: bool) -> json.JSONData:
        """Updates this configuration in the Project's symbol sources.

        If a symbol source of type ``appStoreConnect`` already exists the ID must match and it
        will be updated.  If no ``appStoreConnect`` source exists yet it is added.

        :param allow_multiple: Whether multiple appStoreConnect sources are allowed for this
           project.

        :returns: The new value of the sources.  Use this in a call to
           `ProjectEndpoint.create_audit_entry()` to create an audit log.

        :raises ValueError: if an ``appStoreConnect`` source already exists but the ID does not
           match
        """
        with transaction.atomic():
            all_sources_raw = project.get_option(SYMBOL_SOURCES_PROP_NAME)
            all_sources = json.loads(all_sources_raw) if all_sources_raw else []
            for i, source in enumerate(all_sources):
                if source.get("type") == SYMBOL_SOURCE_TYPE_NAME:
                    if source.get("id") == self.id:
                        all_sources[i] = self.to_json()
                        break
                    elif not allow_multiple:
                        raise ValueError(
                            "Existing appStoreConnect symbolSource config does not match id"
                        )
            else:
                # No matching existing appStoreConnect symbol source, append it.
                all_sources.append(self.to_json())
            project.update_option(SYMBOL_SOURCES_PROP_NAME, json.dumps(all_sources))
        return all_sources


class AppConnectClient:
    """Client to interact with a single app from App Store Connect.

    Note that on creating this instance it will already connect to iTunes to set the
    provider for this session.  You also don't want to use the same iTunes cookie in
    multiple connections, so only make one client for a project.
    """

    def __init__(
        self,
        api_credentials: appstore_connect.AppConnectCredentials,
        app_id: str,
    ) -> None:
        """Internal init, use one of the classmethods instead."""
        self._api_credentials = api_credentials
        self._session = requests.Session()
        self._app_id = app_id

    @classmethod
    def from_project(cls, project: Project, config_id: str) -> "AppConnectClient":
        """Creates a new client for the project's appStoreConnect symbol source.

        This will load the configuration from the symbol sources for the project if a symbol
        source of the ``appStoreConnect`` type can be found which also has matching
        ``credentials_id``.
        """
        config = AppStoreConnectConfig.from_project_config(project, config_id)
        return cls.from_config(config)

    @classmethod
    def from_config(cls, config: AppStoreConnectConfig) -> "AppConnectClient":
        """Creates a new client from an appStoreConnect symbol source config.

        This config is normally stored as a symbol source of type ``appStoreConnect`` in a
        project's ``sentry:symbol_sources`` property.
        """
        api_credentials = appstore_connect.AppConnectCredentials(
            key_id=config.appconnectKey,
            key=config.appconnectPrivateKey,
            issuer_id=config.appconnectIssuer,
        )
        return cls(
            api_credentials=api_credentials,
            app_id=config.appId,
        )

    def list_builds(self) -> List[BuildInfo]:
        """Returns the available AppStore builds."""
        return appstore_connect.get_build_info(self._session, self._api_credentials, self._app_id)

    def download_dsyms(self, build: BuildInfo, path: pathlib.Path) -> None:
        """Downloads the dSYMs from the build into the filename given by `path`.

        The dSYMs are downloaded as a zipfile so when this call succeeds the file at `path`
        will contain a zipfile.
        """
        with sentry_sdk.start_span(op="dsym", description="Download dSYMs"):
            if not isinstance(build.dsym_url, str):
                if build.dsym_url is NoDsymUrl.NOT_NEEDED:
                    raise NoDsymsError
                elif build.dsym_url is NoDsymUrl.PENDING:
                    raise PendingDsymsError
                else:
                    raise ValueError(f"dSYM URL missing: {build.dsym_url}")

            logger.debug("Fetching dSYMs from: %s", build.dsym_url)
            appstore_connect.download_dsyms(
                self._session, self._api_credentials, build.dsym_url, path
            )
