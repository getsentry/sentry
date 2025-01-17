from django.db import models

from sentry.db.models.fields.encryption import EncryptedStringField
from sentry.testutils.cases import TestCase


class EncryptedStringFieldTestModel(models.Model):
    id = models.AutoField(primary_key=True)
    encrypted_string = EncryptedStringField()

    class Meta:
        app_label = "fixtures"


class EncryptedStringFieldNullableTestModel(models.Model):
    id = models.AutoField(primary_key=True)
    encrypted_string = EncryptedStringField(null=True)

    class Meta:
        app_label = "fixtures"


class EncryptedStringFieldTest(TestCase):
    def test_encrypted_string_field_save(self):
        obj = EncryptedStringFieldTestModel.objects.create(encrypted_string="test")
        self.assertEqual(obj.encrypted_string, "test")

    def test_encrypted_string_field_empty(self):
        obj = EncryptedStringFieldTestModel.objects.create(encrypted_string="")
        self.assertEqual(obj.encrypted_string, "")

    def test_encrypted_field_raw_value_is_bytes(self):
        field = EncryptedStringField()
        raw_value = field.get_prep_value("test")
        self.assertTrue(type(raw_value) is bytes)

    def test_encrypt_and_decrypt_value(self):
        obj = EncryptedStringFieldTestModel.objects.create(encrypted_string="test")
        self.assertEqual(obj.encrypted_string, "test")

        fetched_obj = EncryptedStringFieldTestModel.objects.get(id=obj.id)
        self.assertEqual(fetched_obj.encrypted_string, "test")

    def test_encrypted_field_support_for_null_values(self):
        obj = EncryptedStringFieldNullableTestModel.objects.create(encrypted_string=None)
        self.assertEqual(obj.encrypted_string, None)

        fetched_obj = EncryptedStringFieldNullableTestModel.objects.get(id=obj.id)
        self.assertEqual(fetched_obj.encrypted_string, None)
