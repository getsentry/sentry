import datetime
from collections import namedtuple
from dateutil import parser
from typing import Optional

import requests
from dateutil import parser

from sentry.models.project import Project
from sentry.utils import fernet_encrypt as encrypt
from sentry.utils import json

from . import appstore_connect, itunes_connect

# We don't know the validity for sure, but we estimate 2 weeks
TOKEN_VALIDITY = datetime.timedelta(weeks=2)

AppConnectCredentialValidity = namedtuple(
    "AppConnectCredentialValidity",
    ["appstore_credentials_valid", "itunes_session_valid", "expiration_date"],
)


def credentials_key_name():
    return "sentry:appleconnect_key"


def symbol_sources_prop_name():
    return "sentry:symbol_sources"


def get_app_store_credentials(
    project: Project, credentials_id: Optional[str]
) -> Optional[json.JSONData]:
    sources_config = project.get_option(symbol_sources_prop_name())

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


def validate_credentials(
    project: Project, credentials_id: Optional[str]
) -> Optional[AppConnectCredentialValidity]:
    credentials = get_app_store_credentials(project, credentials_id)
    key = project.get_option(credentials_key_name())

    if key is None or credentials is None:
        return None

    expiration_date = None
    refresh_date = credentials.get("refreshDate")

    if refresh_date is not None:
        expiration_date = parser.isoparse(refresh_date) + TOKEN_VALIDITY

    secrets = encrypt.decrypt_object(credentials.get("encrypted"), key)

    credentials = appstore_connect.AppConnectCredentials(
        key_id=credentials.get("appconnectKey"),
        key=secrets.get("appconnectPrivateKey"),
        issuer_id=credentials.get("appconnectIssuer"),
    )

    session = requests.Session()
    apps = appstore_connect.get_apps(session, credentials)

    appstore_valid = apps is not None
    itunes_connect.load_session_cookie(session, secrets.get("itunesSession"))
    itunes_session_info = itunes_connect.get_session_info(session)

    itunes_session_valid = itunes_session_info is not None

    return AppConnectCredentialValidity(
        appstore_credentials_valid=appstore_valid,
        itunes_session_valid=itunes_session_valid,
        expiration_date=expiration_date,
    )
