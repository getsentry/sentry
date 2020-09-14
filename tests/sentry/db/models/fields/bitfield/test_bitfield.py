from __future__ import absolute_import

import unittest
import pickle

import six

from django import forms
from django.db import connection, models
from django.db.models import F
from django.test import TestCase

from bitfield import Bit, BitField, BitHandler
from bitfield.compat import bitand, bitor


class BitFieldTestModel(models.Model):
    class Meta:
        app_label = "sentry"

    flags = BitField(
        flags=("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"), default=3, db_column="another_name"
    )


class BitFieldTestModelForm(forms.ModelForm):
    class Meta:
        model = BitFieldTestModel
        exclude = tuple()


class BitHandlerTest(unittest.TestCase):
    def test_comparison(self):
        bithandler_1 = BitHandler(0, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        bithandler_2 = BitHandler(1, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        bithandler_3 = BitHandler(0, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        assert bithandler_1 == bithandler_1
        assert bithandler_1 != bithandler_2
        assert bithandler_1 == bithandler_3

    def test_defaults(self):
        bithandler = BitHandler(0, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        # Default value of 0.
        self.assertEquals(int(bithandler), 0)
        # Test bit numbers.
        self.assertEquals(int(bithandler.FLAG_0.number), 0)
        self.assertEquals(int(bithandler.FLAG_1.number), 1)
        self.assertEquals(int(bithandler.FLAG_2.number), 2)
        self.assertEquals(int(bithandler.FLAG_3.number), 3)
        # Negative test non-existant key.
        self.assertRaises(AttributeError, lambda: bithandler.FLAG_4)
        # Test bool().
        self.assertEquals(bool(bithandler.FLAG_0), False)
        self.assertEquals(bool(bithandler.FLAG_1), False)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

    def test_nonzero_default(self):
        bithandler = BitHandler(1, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        self.assertEquals(bool(bithandler.FLAG_0), True)
        self.assertEquals(bool(bithandler.FLAG_1), False)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

        bithandler = BitHandler(2, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        self.assertEquals(bool(bithandler.FLAG_0), False)
        self.assertEquals(bool(bithandler.FLAG_1), True)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

        bithandler = BitHandler(3, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        self.assertEquals(bool(bithandler.FLAG_0), True)
        self.assertEquals(bool(bithandler.FLAG_1), True)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

        bithandler = BitHandler(4, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        self.assertEquals(bool(bithandler.FLAG_0), False)
        self.assertEquals(bool(bithandler.FLAG_1), False)
        self.assertEquals(bool(bithandler.FLAG_2), True)
        self.assertEquals(bool(bithandler.FLAG_3), False)

    def test_mutation(self):
        bithandler = BitHandler(0, ("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"))
        self.assertEquals(bool(bithandler.FLAG_0), False)
        self.assertEquals(bool(bithandler.FLAG_1), False)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

        bithandler = BitHandler(bithandler | 1, bithandler._keys)
        self.assertEquals(bool(bithandler.FLAG_0), True)
        self.assertEquals(bool(bithandler.FLAG_1), False)
        self.assertEquals(bool(bithandler.FLAG_2), False)
        self.assertEquals(bool(bithandler.FLAG_3), False)

        bithandler ^= 3
        self.assertEquals(int(bithandler), 2)

        self.assertEquals(bool(bithandler & 1), False)

        bithandler.FLAG_0 = False
        self.assertEquals(bithandler.FLAG_0, False)

        bithandler.FLAG_1 = True
        self.assertEquals(bithandler.FLAG_0, False)
        self.assertEquals(bithandler.FLAG_1, True)

        bithandler.FLAG_2 = False
        self.assertEquals(bithandler.FLAG_0, False)
        self.assertEquals(bithandler.FLAG_1, True)
        self.assertEquals(bithandler.FLAG_2, False)


class BitTest(unittest.TestCase):
    def test_int(self):
        bit = Bit(0)
        self.assertEquals(int(bit), 1)
        self.assertEquals(bool(bit), True)
        self.assertFalse(not bit)

    def test_comparison(self):
        self.assertEquals(Bit(0), Bit(0))
        self.assertNotEquals(Bit(1), Bit(0))
        self.assertNotEquals(Bit(0, 0), Bit(0, 1))
        self.assertEquals(Bit(0, 1), Bit(0, 1))
        self.assertEquals(Bit(0), 1)

    def test_and(self):
        self.assertEquals(1 & Bit(2), 0)
        self.assertEquals(1 & Bit(0), 1)
        self.assertEquals(1 & ~Bit(0), 0)
        self.assertEquals(Bit(0) & Bit(2), 0)
        self.assertEquals(Bit(0) & Bit(0), 1)
        self.assertEquals(Bit(0) & ~Bit(0), 0)

    def test_or(self):
        self.assertEquals(1 | Bit(2), 5)
        self.assertEquals(1 | Bit(5), 33)
        self.assertEquals(1 | ~Bit(2), -5)
        self.assertEquals(Bit(0) | Bit(2), 5)
        self.assertEquals(Bit(0) | Bit(5), 33)
        self.assertEquals(Bit(0) | ~Bit(2), -5)

    def test_xor(self):
        self.assertEquals(1 ^ Bit(2), 5)
        self.assertEquals(1 ^ Bit(0), 0)
        self.assertEquals(1 ^ Bit(1), 3)
        self.assertEquals(1 ^ Bit(5), 33)
        self.assertEquals(1 ^ ~Bit(2), -6)
        self.assertEquals(Bit(0) ^ Bit(2), 5)
        self.assertEquals(Bit(0) ^ Bit(0), 0)
        self.assertEquals(Bit(0) ^ Bit(1), 3)
        self.assertEquals(Bit(0) ^ Bit(5), 33)
        self.assertEquals(Bit(0) ^ ~Bit(2), -6)


class BitFieldTest(TestCase):
    def test_basic(self):
        # Create instance and make sure flags are working properly.
        instance = BitFieldTestModel.objects.create(flags=1)
        self.assertTrue(instance.flags.FLAG_0)
        self.assertFalse(instance.flags.FLAG_1)
        self.assertFalse(instance.flags.FLAG_2)
        self.assertFalse(instance.flags.FLAG_3)

    def test_regression_1425(self):
        # Creating new instances shouldn't allow negative values.
        instance = BitFieldTestModel.objects.create(flags=-1)
        self.assertEqual(instance.flags._value, 15)
        self.assertTrue(instance.flags.FLAG_0)
        self.assertTrue(instance.flags.FLAG_1)
        self.assertTrue(instance.flags.FLAG_2)
        self.assertTrue(instance.flags.FLAG_3)

        cursor = connection.cursor()
        flags_field = BitFieldTestModel._meta.get_field("flags")
        flags_db_column = flags_field.db_column or flags_field.name
        cursor.execute(
            "INSERT INTO %s (%s) VALUES (-1)" % (BitFieldTestModel._meta.db_table, flags_db_column)
        )
        # There should only be the one row we inserted through the cursor.
        instance = BitFieldTestModel.objects.get(flags=-1)
        self.assertTrue(instance.flags.FLAG_0)
        self.assertTrue(instance.flags.FLAG_1)
        self.assertTrue(instance.flags.FLAG_2)
        self.assertTrue(instance.flags.FLAG_3)
        instance.save()

        self.assertEqual(BitFieldTestModel.objects.filter(flags=15).count(), 2)
        self.assertEqual(BitFieldTestModel.objects.filter(flags__lt=0).count(), 0)

    def test_select(self):
        BitFieldTestModel.objects.create(flags=3)
        # This F().bitor style of lookup is used extensively throughout sentry/getsentry.
        # If this test breaks, then that most likely means our custom lookup doesn't work
        # with sentry/getsentry code.
        self.assertTrue(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitor(BitFieldTestModel.flags.FLAG_1)
            ).exists()
        )
        self.assertTrue(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitor(BitFieldTestModel.flags.FLAG_0)
            ).exists()
        )
        self.assertFalse(
            BitFieldTestModel.objects.exclude(
                flags=F("flags").bitor(BitFieldTestModel.flags.FLAG_0)
            ).exists()
        )
        self.assertFalse(
            BitFieldTestModel.objects.exclude(
                flags=F("flags").bitor(BitFieldTestModel.flags.FLAG_1)
            ).exists()
        )

    def test_update(self):
        instance = BitFieldTestModel.objects.create(flags=0)
        self.assertFalse(instance.flags.FLAG_0)

        BitFieldTestModel.objects.filter(pk=instance.pk).update(
            flags=bitor(F("flags"), BitFieldTestModel.flags.FLAG_1)
        )
        instance = BitFieldTestModel.objects.get(pk=instance.pk)
        self.assertTrue(instance.flags.FLAG_1)

        BitFieldTestModel.objects.filter(pk=instance.pk).update(
            flags=bitor(
                F("flags"), ((~BitFieldTestModel.flags.FLAG_0 | BitFieldTestModel.flags.FLAG_3))
            )
        )
        instance = BitFieldTestModel.objects.get(pk=instance.pk)
        self.assertFalse(instance.flags.FLAG_0)
        self.assertTrue(instance.flags.FLAG_1)
        self.assertTrue(instance.flags.FLAG_3)
        self.assertFalse(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitor(BitFieldTestModel.flags.FLAG_0)
            ).exists()
        )

        BitFieldTestModel.objects.filter(pk=instance.pk).update(
            flags=bitand(F("flags"), ~BitFieldTestModel.flags.FLAG_3)
        )
        instance = BitFieldTestModel.objects.get(pk=instance.pk)
        self.assertFalse(instance.flags.FLAG_0)
        self.assertTrue(instance.flags.FLAG_1)
        self.assertFalse(instance.flags.FLAG_3)

    def test_update_with_handler(self):
        instance = BitFieldTestModel.objects.create(flags=0)
        self.assertFalse(instance.flags.FLAG_0)

        instance.flags.FLAG_1 = True

        BitFieldTestModel.objects.filter(pk=instance.pk).update(
            flags=bitor(F("flags"), instance.flags)
        )
        instance = BitFieldTestModel.objects.get(pk=instance.pk)
        self.assertTrue(instance.flags.FLAG_1)

    def test_negate(self):
        BitFieldTestModel.objects.create(
            flags=BitFieldTestModel.flags.FLAG_0 | BitFieldTestModel.flags.FLAG_1
        )
        BitFieldTestModel.objects.create(flags=BitFieldTestModel.flags.FLAG_1)
        # This F().bitand style of lookup is used extensively throughout sentry/getsentry.
        # If this test breaks, then that most likely means our custom lookup doesn't work
        # with sentry/getsentry code.
        self.assertEqual(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitand(~BitFieldTestModel.flags.FLAG_0)
            ).count(),
            1,
        )
        self.assertEqual(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitand(~BitFieldTestModel.flags.FLAG_1)
            ).count(),
            0,
        )
        self.assertEqual(
            BitFieldTestModel.objects.filter(
                flags=F("flags").bitand(~BitFieldTestModel.flags.FLAG_2)
            ).count(),
            2,
        )

    def test_default_value(self):
        instance = BitFieldTestModel.objects.create()
        self.assertTrue(instance.flags.FLAG_0)
        self.assertTrue(instance.flags.FLAG_1)
        self.assertFalse(instance.flags.FLAG_2)
        self.assertFalse(instance.flags.FLAG_3)

    def test_binary_capacity(self):
        import math
        from django.db.models.fields import BigIntegerField

        # Local maximum value, slow canonical algorithm
        MAX_COUNT = int(math.floor(math.log(BigIntegerField.MAX_BIGINT, 2)))

        # Big flags list
        flags = ["f" + six.text_type(i) for i in range(100)]

        try:
            BitField(flags=flags[:MAX_COUNT])
        except ValueError:
            self.fail("It should work well with these flags")

        self.assertRaises(ValueError, BitField, flags=flags[: (MAX_COUNT + 1)])

    def test_dictionary_init(self):
        flags = {
            0: "zero",
            1: "first",
            10: "tenth",
            2: "second",
            "wrongkey": "wrongkey",
            100: "bigkey",
            -100: "smallkey",
        }

        try:
            bf = BitField(flags)
        except ValueError:
            self.fail("It should work well with these flags")

        self.assertEquals(
            bf.flags, ["zero", "first", "second", "", "", "", "", "", "", "", "tenth"]
        )
        self.assertRaises(ValueError, BitField, flags={})
        self.assertRaises(ValueError, BitField, flags={"wrongkey": "wrongkey"})
        self.assertRaises(ValueError, BitField, flags={"1": "non_int_key"})

    def test_defaults_as_key_names(self):
        class TestModel(models.Model):
            flags = BitField(
                flags=("FLAG_0", "FLAG_1", "FLAG_2", "FLAG_3"), default=("FLAG_1", "FLAG_2")
            )

        field = TestModel._meta.get_field("flags")
        self.assertEquals(field.default, TestModel.flags.FLAG_1 | TestModel.flags.FLAG_2)

    def test_pickle_integration(self):
        inst = BitFieldTestModel.objects.create(flags=1)
        data = pickle.dumps(inst)
        inst = pickle.loads(data)
        self.assertEquals(type(inst.flags), BitHandler)
        self.assertEquals(int(inst.flags), 1)


class BitFieldSerializationTest(unittest.TestCase):
    def test_can_unserialize_bithandler(self):
        bf = BitFieldTestModel()
        bf.flags.FLAG_0 = 1
        bf.flags.FLAG_1 = 0
        data = pickle.dumps(bf)
        inst = pickle.loads(data)
        self.assertTrue(inst.flags.FLAG_0)
        self.assertFalse(inst.flags.FLAG_1)

    def test_added_field(self):
        bf = BitFieldTestModel()
        bf.flags.FLAG_0 = 1
        bf.flags.FLAG_1 = 0
        bf.flags.FLAG_3 = 0
        data = pickle.dumps(bf)
        inst = pickle.loads(data)
        self.assertTrue("FLAG_3" in inst.flags.keys())
