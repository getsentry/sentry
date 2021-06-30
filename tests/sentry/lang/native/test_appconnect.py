import uuid
from datetime import datetime

import pytest

from sentry.lang.native import appconnect
from sentry.utils import json


class TestAppStoreConnectConfig:
    @pytest.fixture
    def now(self):
        # Fixture so we can have one "now" for the entire test and its fixtures.
        return datetime.utcnow()

    @pytest.fixture
    def data(self, now):
        return {
            "type": "appStoreConnect",
            "id": "abc123",
            "name": "Apple App Store Connect",
            "appconnectIssuer": "abc123" * 6,
            "appconnectKey": "abc123",
            "appconnectPrivateKey": "---- BEGIN PRIVATE KEY ---- ABC123...",
            "itunesUser": "someone@example.com",
            "itunesPassword": "a secret",
            "itunesPersonId": "123",
            "itunesSession": "ABC123",
            "itunesCreated": now.isoformat(),
            "appName": "Sample Application",
            "appId": "1234",
            "bundleId": "com.example.app",
            "orgId": 1234,
            "orgName": "Example Organisation",
        }

    def test_from_json_basic(self, data, now):
        config = appconnect.AppStoreConnectConfig.from_json(data)
        assert config.type == "appStoreConnect"
        assert config.id == data["id"]
        assert config.name == data["name"]
        assert config.appconnectIssuer == data["appconnectIssuer"]
        assert config.appconnectPrivateKey == data["appconnectPrivateKey"]
        assert config.itunesUser == data["itunesUser"]
        assert config.itunesPassword == data["itunesPassword"]
        assert config.itunesPersonId == data["itunesPersonId"]
        assert config.itunesSession == data["itunesSession"]
        assert config.itunesCreated == now
        assert config.appName == data["appName"]
        assert config.bundleId == data["bundleId"]
        assert config.orgId == data["orgId"]
        assert config.orgName == data["orgName"]

    def test_from_json_isoformat(self, data, now):
        data["itunesCreated"] = now.isoformat()
        config = appconnect.AppStoreConnectConfig.from_json(data)
        assert config.itunesCreated == now

    def test_from_json_datetime(self, data, now):
        data["itunesCreated"] = now
        config = appconnect.AppStoreConnectConfig.from_json(data)
        assert config.itunesCreated == now

    def test_to_json(self, data, now):
        config = appconnect.AppStoreConnectConfig.from_json(data)
        new_data = config.to_json()

        # Fixup our input to expected JSON format
        data["itunesCreated"] = now.isoformat()

        assert new_data == data

    @pytest.mark.django_db
    def test_from_project_config_empty_sources(self, default_project, data):
        with pytest.raises(KeyError):
            appconnect.AppStoreConnectConfig.from_project_config(default_project, "not-an-id")


class TestAppStoreConnectConfigUpdateProjectSymbolSource:
    @pytest.fixture
    def config(self):
        return appconnect.AppStoreConnectConfig(
            type="appStoreConnect",
            id=uuid.uuid4().hex,
            name="Apple App Store Connect",
            appconnectIssuer="abc123" * 6,
            appconnectKey="abc123key",
            appconnectPrivateKey="----BEGIN PRIVATE KEY---- blabla",
            itunesUser="me@example.com",
            itunesPassword="secret",
            itunesPersonId="123",
            itunesSession="THE-COOKIE",
            itunesCreated=datetime.utcnow(),
            appName="My App",
            appId="123",
            bundleId="com.example.app",
            orgId=123,
            orgName="Example Com",
        )

    @pytest.mark.django_db
    def test_new_source(self, default_project, config):
        sources = config.update_project_symbol_source(default_project)

        cfg = appconnect.AppStoreConnectConfig.from_json(sources[0].copy())
        assert cfg == config

        raw = default_project.get_option(appconnect.SYMBOL_SOURCES_PROP_NAME, default="[]")
        stored_sources = json.loads(raw)
        assert stored_sources == sources

    @pytest.mark.django_db
    def test_new_sources_with_existing(self, default_project, config):
        old_sources = json.dumps(
            [{"type": "not-this-one", "id": "a"}, {"type": "not-this-one", "id": "b"}]
        )
        default_project.update_option(appconnect.SYMBOL_SOURCES_PROP_NAME, old_sources)

        sources = config.update_project_symbol_source(default_project)

        cfg = appconnect.AppStoreConnectConfig.from_project_config(default_project, config.id)
        assert cfg == config

        raw = default_project.get_option(appconnect.SYMBOL_SOURCES_PROP_NAME, default="[]")
        stored_sources = json.loads(raw)
        assert stored_sources == sources

        new_sources = json.loads(old_sources)
        new_sources.append(cfg.to_json())
        assert stored_sources == new_sources

    @pytest.mark.django_db
    def test_update(self, default_project, config):
        config.update_project_symbol_source(default_project)

        updated = appconnect.AppStoreConnectConfig(
            type=config.type,
            id=config.id,
            name=config.name,
            appconnectIssuer=config.appconnectIssuer,
            appconnectKey=config.appconnectKey,
            appconnectPrivateKey=config.appconnectPrivateKey,
            itunesUser=config.itunesUser,
            itunesPassword=config.itunesPassword,
            itunesPersonId=config.itunesPersonId,
            itunesSession="A NEW COOKIE",
            itunesCreated=datetime.utcnow(),
            appName=config.appName,
            appId=config.appId,
            bundleId=config.bundleId,
            orgId=config.orgId,
            orgName=config.orgName,
        )

        updated.update_project_symbol_source(default_project)

        current = appconnect.AppStoreConnectConfig.from_project_config(default_project, config.id)
        assert current.itunesSession == "A NEW COOKIE"

    @pytest.mark.django_db
    def test_update_no_matching_id(self, default_project, config):
        config.update_project_symbol_source(default_project)

        updated = appconnect.AppStoreConnectConfig(
            type=config.type,
            id=uuid.uuid4().hex,
            name=config.name,
            appconnectIssuer=config.appconnectIssuer,
            appconnectKey=config.appconnectKey,
            appconnectPrivateKey=config.appconnectPrivateKey,
            itunesUser=config.itunesUser,
            itunesPassword=config.itunesPassword,
            itunesPersonId=config.itunesPersonId,
            itunesSession="A NEW COOKIE",
            itunesCreated=datetime.utcnow(),
            appName=config.appName,
            appId=config.appId,
            bundleId=config.bundleId,
            orgId=config.orgId,
            orgName=config.orgName,
        )

        with pytest.raises(ValueError):
            updated.update_project_symbol_source(default_project)
