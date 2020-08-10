from __future__ import absolute_import

from django.utils.encoding import force_text
from django import forms
from django.db import models

from sentry.db.models.fields.jsonfield import JSONField
from sentry.testutils import TestCase


class JSONFieldTestModel(models.Model):
    json = JSONField("test", null=True, blank=True)

    class Meta:
        app_label = "sentry"


class JSONFieldWithDefaultTestModel(models.Model):
    json = JSONField(default={"sukasuka": "YAAAAAZ"})

    class Meta:
        app_label = "sentry"


class BlankJSONFieldTestModel(models.Model):
    null_json = JSONField(null=True)
    blank_json = JSONField(blank=True)

    class Meta:
        app_label = "sentry"


def default():
    return {"x": 2}


class CallableDefaultModel(models.Model):
    json = JSONField(default=default)

    class Meta:
        app_label = "sentry"


class JSONFieldTest(TestCase):
    def test_json_field(self):
        obj = JSONFieldTestModel(
            json="""{
            "spam": "eggs"
        }"""
        )
        self.assertEqual(obj.json, {"spam": "eggs"})

    def test_json_field_empty(self):
        obj = JSONFieldTestModel(json="")
        self.assertEqual(obj.json, None)

    def test_json_field_save(self):
        JSONFieldTestModel.objects.create(
            id=10,
            json="""{
                "spam": "eggs"
            }""",
        )
        obj2 = JSONFieldTestModel.objects.get(id=10)
        self.assertEqual(obj2.json, {"spam": "eggs"})

    def test_json_field_save_empty(self):
        JSONFieldTestModel.objects.create(id=10, json="")
        obj2 = JSONFieldTestModel.objects.get(id=10)
        self.assertEqual(obj2.json, None)

    def test_db_prep_save(self):
        field = JSONField("test")
        field.set_attributes_from_name("json")
        self.assertEqual(None, field.get_db_prep_save(None, connection=None))
        self.assertEqual(
            '{"spam":"eggs"}', field.get_db_prep_save({"spam": "eggs"}, connection=None)
        )

    def test_formfield(self):
        field = JSONField("test")
        field.set_attributes_from_name("json")
        formfield = field.formfield()

        self.assertEqual(type(formfield), forms.CharField)
        self.assertEqual(type(formfield.widget), forms.Textarea)

    def test_formfield_clean_blank(self):
        field = JSONField("test")
        formfield = field.formfield()
        self.assertRaisesMessage(
            forms.ValidationError,
            force_text(formfield.error_messages["required"]),
            formfield.clean,
            value="",
        )

    def test_formfield_clean_none(self):
        field = JSONField("test")
        formfield = field.formfield()
        self.assertRaisesMessage(
            forms.ValidationError,
            force_text(formfield.error_messages["required"]),
            formfield.clean,
            value=None,
        )

    def test_formfield_null_and_blank_clean_blank(self):
        field = JSONField("test", null=True, blank=True)
        formfield = field.formfield()
        self.assertEqual(formfield.clean(value=""), "")

    def test_formfield_blank_clean_blank(self):
        field = JSONField("test", null=False, blank=True)
        formfield = field.formfield()
        self.assertEqual(formfield.clean(value=""), "")

    def test_default_value(self):
        obj = JSONFieldWithDefaultTestModel.objects.create()
        obj = JSONFieldWithDefaultTestModel.objects.get(id=obj.id)
        self.assertEqual(obj.json, {"sukasuka": "YAAAAAZ"})

    def test_query_object(self):
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
        self.assertRaises(
            TypeError, lambda: JSONFieldTestModel.objects.filter(json__contains=["baz", "foo"])
        )

    def test_query_isnull(self):
        JSONFieldTestModel.objects.create(json=None)
        JSONFieldTestModel.objects.create(json={})
        JSONFieldTestModel.objects.create(json={"foo": "bar"})

        self.assertEqual(1, JSONFieldTestModel.objects.filter(json=None).count())
        self.assertEqual(None, JSONFieldTestModel.objects.get(json=None).json)

    def test_jsonfield_blank(self):
        BlankJSONFieldTestModel.objects.create(blank_json="", null_json=None)
        obj = BlankJSONFieldTestModel.objects.get()
        self.assertEqual(None, obj.null_json)
        self.assertEqual("", obj.blank_json)
        obj.save()
        obj = BlankJSONFieldTestModel.objects.get()
        self.assertEqual(None, obj.null_json)
        self.assertEqual("", obj.blank_json)

    def test_callable_default(self):
        CallableDefaultModel.objects.create()
        obj = CallableDefaultModel.objects.get()
        self.assertEqual({"x": 2}, obj.json)

    def test_callable_default_overridden(self):
        CallableDefaultModel.objects.create(json={"x": 3})
        obj = CallableDefaultModel.objects.get()
        self.assertEqual({"x": 3}, obj.json)

    def test_mutable_default_checking(self):
        obj1 = JSONFieldWithDefaultTestModel()
        obj2 = JSONFieldWithDefaultTestModel()

        obj1.json["foo"] = "bar"
        self.assertNotIn("foo", obj2.json)

    def test_invalid_json(self):
        obj = JSONFieldTestModel()
        obj.json = '{"foo": 2}'
        assert "foo" in obj.json
        with self.assertRaises(forms.ValidationError):
            obj.json = '{"foo"}'

    def test_invalid_json_default(self):
        with self.assertRaises(ValueError):
            JSONField("test", default='{"foo"}')


class SavingModelsTest(TestCase):
    def test_saving_null(self):
        obj = BlankJSONFieldTestModel.objects.create(blank_json="", null_json=None)
        self.assertEqual("", obj.blank_json)
        self.assertEqual(None, obj.null_json)
