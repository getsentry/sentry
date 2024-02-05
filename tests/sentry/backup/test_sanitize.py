from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from dateutil.parser import parse as parse_datetime
from django.core.serializers import serialize
from django.db import models

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
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.slug import SentrySlugField
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.json import JSONData

FAKE_EMAIL = "test@fake.com"
FAKE_NAME = "Fake Name"
FAKE_NICKNAME = "Fake Nickname"
FAKE_SLUG = "fake-slug"
FAKE_TEXT = "This is some text."

CURR_DATE = datetime.now()
CURR_YEAR = CURR_DATE.year
NEXT_YEAR = CURR_YEAR + 1
DELTA_YEAR = timedelta(days=(datetime(NEXT_YEAR, 1, 1) - CURR_DATE).days + 1)

FAKE_DATE_ADDED = CURR_DATE - timedelta(days=7)
FAKE_DATE_UPDATED = CURR_DATE - timedelta(days=6)


class FakeSanitizableModel(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    email = models.EmailField(null=True, max_length=75)
    name = models.CharField(null=True, max_length=64)
    slug = SentrySlugField(null=True)
    nickname = models.CharField(null=True, max_length=32)
    text = SentrySlugField(null=True, max_length=128)

    class Meta:
        app_label = "test"
        db_table = "test_fake"

    @classmethod
    def sanitize_relocation_json(
        cls, json: JSONData, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        sanitizer.set_email(json, SanitizableField(model_name, "email"))
        sanitizer.set_name_and_slug_pair(
            json, SanitizableField(model_name, "name"), SanitizableField(model_name, "slug")
        )
        sanitizer.set_name(json, SanitizableField(model_name, "nickname"))
        sanitizer.set_string(json, SanitizableField(model_name, "text"))
        return super().sanitize_relocation_json(json, sanitizer, model_name)


@patch("sentry.backup.dependencies.get_model", Mock(return_value=FakeSanitizableModel))
class SanitizerTests(TestCase):
    def serialize_to_json_data(self, models: Sequence[FakeSanitizableModel]) -> JSONData:
        json_string = serialize(
            "json",
            models,
            indent=2,
            use_natural_foreign_keys=False,
            cls=DatetimeSafeDjangoJSONEncoder,
        )
        json_data = json.loads(json_string)
        return json_data

    def test_good_all_sanitizers_set_fields(self):
        model = FakeSanitizableModel(
            date_added=FAKE_DATE_ADDED,
            date_updated=FAKE_DATE_UPDATED,
            email=FAKE_EMAIL,
            name=FAKE_NAME,
            slug=FAKE_SLUG,
            nickname=FAKE_NICKNAME,
            text=FAKE_TEXT,
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

        # Confirm sanitization.
        assert parse_datetime(f0["date_added"]) < s0["date_added"]
        assert parse_datetime(f0["date_updated"]) < s0["date_updated"]
        assert f0["email"] != s0["email"]
        assert f0["name"] != s0["name"]
        assert f0["slug"] != s0["slug"]
        assert f0["nickname"] != s0["nickname"]
        assert f0["text"] != s0["text"]

        # Identical source values remain equal after sanitization.
        assert s0["date_added"] == s1["date_added"]
        assert s0["date_updated"] == s1["date_updated"]
        assert s0["email"] == s1["email"]
        assert s0["name"] == s1["name"]
        assert s0["slug"] == s1["slug"]
        assert s0["nickname"] == s1["nickname"]
        assert s0["text"] == s1["text"]

    def test_good_all_sanitizers_unset_fields(self):
        model = FakeSanitizableModel(
            date_updated=None,
            email=None,
            name=None,
            nickname=None,
            slug=None,
            text=None,
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
        assert s["date_updated"] == f["date_updated"]
        assert s["email"] == f["email"]
        assert s["name"] == f["name"]
        assert s["slug"] == f["slug"]
        assert s["nickname"] == f["nickname"]
        assert s["text"] == f["text"]

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
        invalid = json.loads(
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
        invalid = json.loads(
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
        invalid = json.loads(
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
        invalid = json.loads(
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
        invalid = json.loads(
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
