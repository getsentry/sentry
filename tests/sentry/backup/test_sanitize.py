import os
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import Mock, patch

import orjson
import pytest
from dateutil.parser import parse as parse_datetime
from django.core.serializers import serialize
from django.db import models
from django.db.models import Model

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.helpers import DatetimeSafeDjangoJSONEncoder
from sentry.backup.sanitize import (
    LOWER_CASE_HEX,
    LOWER_CASE_NON_HEX,
    UPPER_CASE_HEX,
    UPPER_CASE_NON_HEX,
    SanitizableField,
    Sanitizer,
    sanitize,
)
from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModelExisting
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.fields.slug import SentrySlugField
from sentry.db.models.fields.uuid import UUIDField
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import BackupTransactionTestCase
from sentry.testutils.silo import strip_silo_mode_test_suffix
from tests.sentry.backup import expect_models, verify_models_in_output

FAKE_EMAIL = "test@fake.com"
FAKE_NAME = "Fake Name"
FAKE_NICKNAME = "Fake Nickname"
FAKE_SLUG = "fake-slug"
FAKE_TEXT = "This is some text."
FAKE_JSON_DICT = {"foo": "bar"}
FAKE_JSON_LIST = ["foo"]
FAKE_IP_V4 = "8.8.8.8"
FAKE_IP_V6 = "9c72:8448:90c4:4e5e:a946:c1f5:71a6:4cc2"
FAKE_URL = "https://sub.domain.example.com/some/path?a=b&c=d#foo"
FAKE_UUID = "6b79316f-cd5c-42fa-ad45-20ce0b1f0725"

CURR_DATE = datetime.now()
CURR_YEAR = CURR_DATE.year
NEXT_YEAR = CURR_YEAR + 1
DELTA_YEAR = timedelta(days=(datetime(NEXT_YEAR, 1, 1) - CURR_DATE).days + 1)

FAKE_DATE_ADDED = CURR_DATE - timedelta(days=7)
FAKE_DATE_UPDATED = CURR_DATE - timedelta(days=6)


class FakeSanitizableModel(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Excluded

    email = models.EmailField(null=True, max_length=75)
    name = models.CharField(null=True, max_length=64)
    slug = SentrySlugField(null=True)
    nickname = models.CharField(null=True, max_length=32)
    text = SentrySlugField(null=True, max_length=128)
    json_dict = JSONField(null=True, default=dict)
    json_list = JSONField(null=True, default=list)
    ip_v4 = models.GenericIPAddressField(null=True)
    ip_v6 = models.GenericIPAddressField(null=True)
    url = models.URLField(null=True)
    uuid = UUIDField(null=True)

    class Meta:
        app_label = "test"
        db_table = "test_fake"

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_name(json, SanitizableField(model_name, "nickname"))
        sanitizer.set_string(json, SanitizableField(model_name, "text"))
        sanitizer.set_json(json, SanitizableField(model_name, "json_dict"), {})
        sanitizer.set_json(json, SanitizableField(model_name, "json_list"), [])


@patch("sentry.backup.dependencies.get_model", Mock(return_value=FakeSanitizableModel))
class SanitizationUnitTests(TestCase):
    def serialize_to_json_data(self, models: Sequence[FakeSanitizableModel]) -> Any:
        json_string = serialize(
            "json",
            models,
            indent=2,
            use_natural_foreign_keys=False,
            cls=DatetimeSafeDjangoJSONEncoder,
        )
        json_data = orjson.loads(json_string)
        return json_data

    def test_good_all_sanitizers_set_fields(self):
        model = FakeSanitizableModel(
            date_added=FAKE_DATE_ADDED,
            date_updated=FAKE_DATE_UPDATED,
            email=FAKE_EMAIL,
            name=FAKE_NAME,
            slug=FAKE_SLUG,
            nickname=FAKE_NICKNAME,
            json_dict=FAKE_JSON_DICT.copy(),
            json_list=FAKE_JSON_LIST.copy(),
            text=FAKE_TEXT,
            ip_v4=FAKE_IP_V4,
            ip_v6=FAKE_IP_V6,
            url=FAKE_URL,
            uuid=FAKE_UUID,
        )
        faked = self.serialize_to_json_data([model, model])
        sanitized = sanitize(faked, DELTA_YEAR)
        f0 = faked[0]["fields"]
        s0 = sanitized[0]["fields"]
        s1 = sanitized[1]["fields"]

        # Confirm typing.
        assert isinstance(s0["date_added"], datetime)
        assert isinstance(s0["date_updated"], datetime)
        assert isinstance(s0["email"], str)
        assert isinstance(s0["name"], str)
        assert isinstance(s0["slug"], str)
        assert isinstance(s0["nickname"], str)
        assert isinstance(s0["text"], str)

        assert isinstance(s0["json_dict"], dict)
        assert s0["json_dict"] == {}

        assert isinstance(s0["json_list"], list)
        assert s0["json_list"] == []

        assert isinstance(s0["ip_v4"], str)
        assert s0["ip_v4"].count(".") == 3

        assert isinstance(s0["ip_v6"], str)
        assert s0["ip_v6"].count(":") == 7

        assert isinstance(s0["url"], str)
        assert isinstance(s0["uuid"], str)

        # Confirm sanitization.
        assert parse_datetime(f0["date_added"]) < s0["date_added"]
        assert parse_datetime(f0["date_updated"]) < s0["date_updated"]
        assert f0["email"] != s0["email"]
        assert f0["name"] != s0["name"]
        assert f0["slug"] != s0["slug"]
        assert f0["nickname"] != s0["nickname"]
        assert f0["text"] != s0["text"]
        assert f0["json_dict"] != s0["json_dict"]
        assert f0["json_list"] != s0["json_list"]
        assert f0["ip_v4"] != s0["ip_v4"]
        assert f0["ip_v6"] != s0["ip_v6"]
        assert f0["url"] != s0["url"]
        assert f0["uuid"] != s0["uuid"]

        # Identical source values remain equal after sanitization.
        assert s0["date_added"] == s1["date_added"]
        assert s0["date_updated"] == s1["date_updated"]
        assert s0["email"] == s1["email"]
        assert s0["name"] == s1["name"]
        assert s0["slug"] == s1["slug"]
        assert s0["nickname"] == s1["nickname"]
        assert s0["text"] == s1["text"]
        assert s0["json_dict"] == s1["json_dict"]
        assert s0["json_list"] == s1["json_list"]
        assert s0["ip_v4"] == s1["ip_v4"]
        assert s0["ip_v6"] == s1["ip_v6"]
        assert s0["url"] == s1["url"]
        assert s0["uuid"] == s1["uuid"]

    def test_good_all_sanitizers_unset_fields(self):
        model = FakeSanitizableModel(
            date_updated=None,
            email=None,
            name=None,
            nickname=None,
            slug=None,
            text=None,
            json_dict=None,
            json_list=None,
            ip_v4=None,
            ip_v6=None,
            url=None,
            uuid=None,
        )
        faked = self.serialize_to_json_data([model])
        sanitized = sanitize(faked, DELTA_YEAR)
        f = sanitized[0]["fields"]
        s = sanitized[0]["fields"]

        assert s["date_updated"] is None
        assert s["email"] is None
        assert s["name"] is None
        assert s["slug"] is None
        assert s["nickname"] is None
        assert s["text"] is None
        assert s["json_dict"] is None
        assert s["json_list"] is None
        assert s["ip_v4"] is None
        assert s["ip_v6"] is None
        assert s["url"] is None
        assert s["uuid"] is None

        assert s["date_updated"] == f["date_updated"]
        assert s["email"] == f["email"]
        assert s["name"] == f["name"]
        assert s["slug"] == f["slug"]
        assert s["nickname"] == f["nickname"]
        assert s["text"] == f["text"]
        assert s["json_dict"] == f["json_dict"]
        assert s["json_list"] == f["json_list"]
        assert s["ip_v4"] == f["ip_v4"]
        assert s["ip_v6"] == f["ip_v6"]
        assert s["url"] == f["url"]
        assert s["uuid"] == f["uuid"]

    def test_good_date_all_sanitizers_no_delta(self):
        faked = self.serialize_to_json_data(
            [
                FakeSanitizableModel(
                    date_added=FAKE_DATE_ADDED,
                    date_updated=FAKE_DATE_UPDATED,
                    email=FAKE_EMAIL,
                    name=FAKE_NAME,
                    slug=FAKE_SLUG,
                    nickname=FAKE_NICKNAME,
                    text=FAKE_TEXT,
                    json_dict=FAKE_JSON_DICT.copy(),
                    json_list=FAKE_JSON_LIST.copy(),
                    ip_v4=FAKE_IP_V4,
                    ip_v6=FAKE_IP_V6,
                    url=FAKE_URL,
                    uuid=FAKE_UUID,
                )
            ]
        )
        sanitized = sanitize(faked)
        f = faked[0]["fields"]
        s = sanitized[0]["fields"]

        # Confirm sanitization.
        assert f["email"] != s["email"]
        assert f["name"] != s["name"]
        assert f["slug"] != s["slug"]
        assert f["nickname"] != s["nickname"]
        assert f["text"] != s["text"]
        assert f["json_dict"] != s["json_dict"]
        assert f["json_list"] != s["json_list"]
        assert f["ip_v4"] != s["ip_v4"]
        assert f["ip_v6"] != s["ip_v6"]
        assert f["url"] != s["url"]
        assert f["uuid"] != s["uuid"]
        assert s["date_added"] < s["date_updated"]

    def test_good_dates_preserve_ordering(self):
        faked = self.serialize_to_json_data(
            [
                FakeSanitizableModel(
                    date_added=FAKE_DATE_ADDED,
                    date_updated=FAKE_DATE_UPDATED,
                ),
                FakeSanitizableModel(
                    date_added=FAKE_DATE_ADDED + timedelta(days=2),
                    date_updated=FAKE_DATE_UPDATED + timedelta(days=2),
                ),
                FakeSanitizableModel(
                    date_added=FAKE_DATE_ADDED + timedelta(days=4),
                    date_updated=FAKE_DATE_UPDATED + timedelta(days=4),
                ),
                FakeSanitizableModel(
                    date_added=FAKE_DATE_ADDED + timedelta(days=6),
                    date_updated=FAKE_DATE_UPDATED + timedelta(days=6),
                ),
            ]
        )
        sanitized = sanitize(faked, DELTA_YEAR)
        s0 = sanitized[0]["fields"]
        s1 = sanitized[1]["fields"]
        s2 = sanitized[2]["fields"]
        s3 = sanitized[3]["fields"]

        assert s0["date_added"] < s0["date_updated"]
        assert s0["date_updated"] < s1["date_added"]
        assert s1["date_added"] < s1["date_updated"]
        assert s1["date_updated"] < s2["date_added"]
        assert s2["date_added"] < s2["date_updated"]
        assert s2["date_updated"] < s3["date_added"]
        assert s3["date_added"] < s3["date_updated"]

    def test_good_name_but_no_slug(self):
        faked = self.serialize_to_json_data(
            [
                FakeSanitizableModel(
                    name=FAKE_NAME,
                )
            ]
        )
        sanitized = sanitize(faked, DELTA_YEAR)
        f = faked[0]["fields"]
        s = sanitized[0]["fields"]

        assert f["name"] != s["name"]
        assert s["slug"] is None

    def test_good_default_string_sanitizer_detection(self):
        faked = self.serialize_to_json_data(
            [
                FakeSanitizableModel(
                    text="abcdef",
                ),
                FakeSanitizableModel(
                    text="iqtvxy",
                ),
                FakeSanitizableModel(
                    text="ABCDEF",
                ),
                FakeSanitizableModel(
                    text="ZQWOUN",
                ),
                FakeSanitizableModel(
                    text="123456",
                ),
                FakeSanitizableModel(
                    text="-_:+/)",
                ),
            ]
        )
        sanitized = sanitize(faked, DELTA_YEAR)

        assert faked[0]["fields"]["text"] != sanitized[0]["fields"]["text"]
        assert faked[1]["fields"]["text"] != sanitized[1]["fields"]["text"]
        assert faked[2]["fields"]["text"] != sanitized[2]["fields"]["text"]
        assert faked[3]["fields"]["text"] != sanitized[3]["fields"]["text"]
        assert faked[4]["fields"]["text"] != sanitized[4]["fields"]["text"]
        assert faked[5]["fields"]["text"] != sanitized[5]["fields"]["text"]

        assert all((c in LOWER_CASE_HEX) for c in list(sanitized[0]["fields"]["text"]))
        assert all((c in LOWER_CASE_NON_HEX) for c in list(sanitized[1]["fields"]["text"]))
        assert all((c in UPPER_CASE_HEX) for c in list(sanitized[2]["fields"]["text"]))
        assert all((c in UPPER_CASE_NON_HEX) for c in list(sanitized[3]["fields"]["text"]))
        assert all((c in "0123456789") for c in list(sanitized[4]["fields"]["text"]))
        assert all(c.isascii() for c in list(sanitized[5]["fields"]["text"]))

    def test_bad_invalid_datetime_type(self):
        invalid = orjson.loads(
            """
                {
                    "model": "test.fakesanitizablemodel",
                    "pk": 1,
                    "fields": {
                        "date_updated": "INVALID"
                    }
                }
            """
        )
        with pytest.raises(TypeError):
            sanitize([invalid])

    def test_bad_invalid_email_type(self):
        invalid = orjson.loads(
            """
                {
                    "model": "test.fakesanitizablemodel",
                    "pk": 1,
                    "fields": {
                        "email": 123
                    }
                }
            """
        )
        with pytest.raises(TypeError):
            sanitize([invalid])

    def test_bad_invalid_name_type(self):
        invalid = orjson.loads(
            """
                {
                    "model": "test.fakesanitizablemodel",
                    "pk": 1,
                    "fields": {
                        "name": 123
                    }
                }
            """
        )
        with pytest.raises(TypeError):
            sanitize([invalid])

    def test_bad_invalid_slug_type(self):
        invalid = orjson.loads(
            """
                {
                    "model": "test.fakesanitizablemodel",
                    "pk": 1,
                    "fields": {
                        "name": "foo",
                        "slug": 123
                    }
                }
            """
        )
        with pytest.raises(TypeError):
            sanitize([invalid])

    def test_bad_invalid_string_type(self):
        invalid = orjson.loads(
            """
                {
                    "model": "test.fakesanitizablemodel",
                    "pk": 1,
                    "fields": {
                        "text": 123
                    }
                }
            """
        )
        with pytest.raises(TypeError):
            sanitize([invalid])


class IntegrationTestCase(TestCase):
    def sanitize_and_compare(self, unsanitized_json: Any) -> Any:
        root_dir = os.path.dirname(os.path.realpath(__file__))

        # Use the same data for monolith and region mode.
        class_name = strip_silo_mode_test_suffix(self.__class__.__name__)
        snapshot_path = f"{root_dir}/snapshots/{class_name}/{self._testMethodName}.pysnap"

        # Go roughly 10 years backward, to ensure that there is no collision in the data when we
        # look for diffs.
        sanitized_json = sanitize(unsanitized_json, timedelta(days=3650))
        assert len(sanitized_json) == len(unsanitized_json)

        # Walk the two JSONs simultaneously, taking note of any changed fields.
        diffs = []
        ordinals: dict[str, int] = defaultdict(lambda: 1)
        for i, sanitized_model in enumerate(sanitized_json):
            unsanitized_model = unsanitized_json[i]
            assert sanitized_model["model"] == unsanitized_model["model"]

            model_name = sanitized_model["model"]
            ordinal = ordinals[model_name]
            ordinals[model_name] = ordinal + 1
            sanitized_fields = sorted(sanitized_model["fields"].keys())
            unsanitized_fields = sorted(unsanitized_model["fields"].keys())
            assert set(sanitized_fields) == set(unsanitized_fields)

            diff = []
            for field_name in sanitized_fields:
                if sanitized_model["fields"][field_name] != unsanitized_model["fields"][field_name]:
                    diff.append(field_name)

            diffs.append(
                {
                    "model_name": model_name,
                    "ordinal": ordinal,
                    "sanitized_fields": diff,
                }
            )

        # Perform the snapshot comparison.
        self.insta_snapshot(diffs, reference_file=snapshot_path)

        return sanitized_json


class SanitizationIntegrationTests(IntegrationTestCase):
    """
    Use some of our existing export JSON fixtures as test cases, ensuring that a consistent set of
    fields is altered by sanitization.
    """

    def test_fresh_install(self):
        with open(get_fixture_path("backup", "fresh-install.json"), "rb") as backup_file:
            unsanitized_json = orjson.loads(backup_file.read())
            self.sanitize_and_compare(unsanitized_json)


SANITIZATION_TESTED: set[NormalizedModelName] = set()


class SanitizationExhaustiveTests(BackupTransactionTestCase, IntegrationTestCase):
    """
    Take our exhaustive test case and sanitize it, ensuring that the specific fields that
    were sanitized remain constant.
    """

    @expect_models(SANITIZATION_TESTED, "__all__")
    def test_clean_pks(self, expected_models: list[type[Model]]):
        self.create_exhaustive_instance(is_superadmin=True)
        unsanitized_json = self.import_export_then_validate(self._testMethodName, reset_pks=True)
        sanitized_json = self.sanitize_and_compare(unsanitized_json)
        verify_models_in_output(expected_models, sanitized_json)
