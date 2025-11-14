from typing import int
import pytest
from django import forms
from django.db import models

from sentry.db.models.fields.jsonfield import JSONField
from sentry.testutils.cases import TestCase


class JSONFieldTestModel(models.Model):
    id = models.AutoField(primary_key=True)
    json = JSONField("test", null=True, blank=True)

    class Meta:
        app_label = "fixtures"


class JSONFieldWithDefaultTestModel(models.Model):
    id = models.AutoField(primary_key=True)
    json = JSONField(default={"sukasuka": "YAAAAAZ"})

    class Meta:
        app_label = "fixtures"


class BlankJSONFieldTestModel(models.Model):
    null_json = JSONField(null=True)
    blank_json = JSONField(blank=True)

    class Meta:
        app_label = "fixtures"


def default() -> dict[str, int]:
    return {"x": 2}


class CallableDefaultModel(models.Model):
    json = JSONField(default=default)

    class Meta:
        app_label = "fixtures"


def test_json_field() -> None:
    obj = JSONFieldTestModel(
        json="""{
        "spam": "eggs"
    }"""
    )
    assert obj.json == {"spam": "eggs"}


def test_json_field_empty() -> None:
    obj = JSONFieldTestModel(json="")
    assert obj.json is None


def test_db_prep_value() -> None:
    field = JSONField("test")
    field.set_attributes_from_name("json")
    assert field.get_db_prep_value(None, connection=None) is None
    assert '{"spam":"eggs"}' == field.get_db_prep_value({"spam": "eggs"}, connection=None)


def test_formfield() -> None:
    field = JSONField("test")
    field.set_attributes_from_name("json")
    formfield = field.formfield()
    assert formfield is not None

    assert type(formfield) is forms.CharField
    assert type(formfield.widget) is forms.Textarea


def test_formfield_clean_blank() -> None:
    field = JSONField("test")
    formfield = field.formfield()
    assert formfield is not None
    with pytest.raises(forms.ValidationError) as excinfo:
        formfield.clean(value="")
    assert excinfo.value.message == formfield.error_messages["required"]


def test_formfield_clean_none() -> None:
    field = JSONField("test")
    formfield = field.formfield()
    assert formfield is not None
    with pytest.raises(forms.ValidationError) as excinfo:
        formfield.clean(value=None)
    assert excinfo.value.message == formfield.error_messages["required"]


def test_formfield_null_and_blank_clean_blank() -> None:
    field = JSONField("test", null=True, blank=True)
    formfield = field.formfield()
    assert formfield is not None
    assert formfield.clean(value="") == ""


def test_formfield_blank_clean_blank() -> None:
    field = JSONField("test", null=False, blank=True)
    formfield = field.formfield()
    assert formfield is not None
    assert formfield.clean(value="") == ""


def test_mutable_default_checking() -> None:
    obj1 = JSONFieldWithDefaultTestModel()
    obj2 = JSONFieldWithDefaultTestModel()

    obj1.json["foo"] = "bar"
    assert "foo" not in obj2.json


def test_invalid_json() -> None:
    obj = JSONFieldTestModel()
    obj.json = '{"foo": 2}'
    assert "foo" in obj.json
    with pytest.raises(forms.ValidationError):
        obj.json = '{"foo"}'


def test_invalid_json_default() -> None:
    with pytest.raises(ValueError):
        JSONField("test", default='{"foo"}')


class JSONFieldTest(TestCase):
    def test_json_field_save(self) -> None:
        JSONFieldTestModel.objects.create(
            id=10,
            json="""{
                "spam": "eggs"
            }""",
        )
        obj2 = JSONFieldTestModel.objects.get(id=10)
        self.assertEqual(obj2.json, {"spam": "eggs"})

    def test_json_field_save_empty(self) -> None:
        JSONFieldTestModel.objects.create(id=10, json="")
        obj2 = JSONFieldTestModel.objects.get(id=10)
        self.assertEqual(obj2.json, None)

    def test_default_value(self) -> None:
        obj = JSONFieldWithDefaultTestModel.objects.create()
        obj = JSONFieldWithDefaultTestModel.objects.get(id=obj.id)
        self.assertEqual(obj.json, {"sukasuka": "YAAAAAZ"})

    def test_query_object(self) -> None:
        JSONFieldTestModel.objects.create(json={})
        JSONFieldTestModel.objects.create(json={"foo": "bar"})
        self.assertEqual(2, JSONFieldTestModel.objects.all().count())
        self.assertEqual(1, JSONFieldTestModel.objects.exclude(json={}).count())
        self.assertEqual(1, JSONFieldTestModel.objects.filter(json={}).count())
        self.assertEqual(1, JSONFieldTestModel.objects.filter(json={"foo": "bar"}).count())
        self.assertEqual(
            1, JSONFieldTestModel.objects.filter(json__contains={"foo": "bar"}).count()
        )
        JSONFieldTestModel.objects.create(json={"foo": "bar", "baz": "bing"})
        self.assertEqual(
            2, JSONFieldTestModel.objects.filter(json__contains={"foo": "bar"}).count()
        )
        # This next one is a bit hard to do without proper lookups, which I'm unlikely to implement.
        # self.assertEqual(1, JSONFieldTestModel.objects.filter(json__contains={'baz':'bing', 'foo':'bar'}).count())
        self.assertEqual(2, JSONFieldTestModel.objects.filter(json__contains="foo").count())
        # This code needs to be implemented!
        pytest.raises(
            TypeError, lambda: JSONFieldTestModel.objects.filter(json__contains=["baz", "foo"])
        )

    def test_query_isnull(self) -> None:
        JSONFieldTestModel.objects.create(json=None)
        JSONFieldTestModel.objects.create(json={})
        JSONFieldTestModel.objects.create(json={"foo": "bar"})

        self.assertEqual(1, JSONFieldTestModel.objects.filter(json=None).count())
        self.assertEqual(None, JSONFieldTestModel.objects.get(json=None).json)

    def test_jsonfield_blank(self) -> None:
        BlankJSONFieldTestModel.objects.create(blank_json="", null_json=None)
        obj = BlankJSONFieldTestModel.objects.get()
        self.assertEqual(None, obj.null_json)
        self.assertEqual("", obj.blank_json)
        obj.save()
        obj = BlankJSONFieldTestModel.objects.get()
        self.assertEqual(None, obj.null_json)
        self.assertEqual("", obj.blank_json)

    def test_callable_default(self) -> None:
        CallableDefaultModel.objects.create()
        obj = CallableDefaultModel.objects.get()
        self.assertEqual({"x": 2}, obj.json)

    def test_callable_default_overridden(self) -> None:
        CallableDefaultModel.objects.create(json={"x": 3})
        obj = CallableDefaultModel.objects.get()
        self.assertEqual({"x": 3}, obj.json)


class SavingModelsTest(TestCase):
    def test_saving_null(self) -> None:
        obj = BlankJSONFieldTestModel.objects.create(blank_json="", null_json=None)
        self.assertEqual("", obj.blank_json)
        self.assertEqual(None, obj.null_json)
