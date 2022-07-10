import collections
from unittest.case import _count_diff_all_purpose, _count_diff_hashable

import pytest


class UnittestCompatMixin:
    def assertEqual(self, first, second):
        assert first == second

    def assertDictEqual(self, first, second):
        assert first == second

    def assertNotEqual(self, first, second):
        assert first != second

    def assertNotIn(self, member, container):
        assert member not in container

    def assertIs(self, expr1, expr2):
        assert expr1 is expr2

    def assertIsNot(self, expr1, expr2):
        assert expr1 is not expr2

    def assertIsNone(self, obj):
        assert obj is None

    def assertIsNotNone(self, obj):
        assert obj is not None

    def assertIsInstance(self, obj, cls):
        assert isinstance(obj, cls)

    def assertTrue(self, expr):
        assert expr

    def assertFalse(self, expr):
        assert not expr

    def assertCountEqual(self, first, second):
        """Asserts that two iterables have the same elements, the same number of
        times, without regard to order.

            self.assertEqual(Counter(list(first)),
                             Counter(list(second)))

         Example:
            - [0, 1, 1] and [1, 0, 1] compare equal.
            - [0, 0, 1] and [0, 1] compare unequal.

        """
        first_seq, second_seq = list(first), list(second)
        try:
            first = collections.Counter(first_seq)
            second = collections.Counter(second_seq)
        except TypeError:
            # Handle case with unhashable elements
            differences = _count_diff_all_purpose(first_seq, second_seq)
        else:
            if first == second:
                return
            differences = _count_diff_hashable(first_seq, second_seq)

        if differences:
            standardMsg = "Element counts were not equal:\n"
            lines = ["First has %d, Second has %d:  %r" % diff for diff in differences]
            diffMsg = "\n".join(lines)
            raise AssertionError(standardMsg + diffMsg)

    assertRaises = pytest.raises


from pytest_django import asserts as django_asserts


def _patch_assert_from_django(func_name):
    inner = getattr(django_asserts, func_name)

    def wrapper(self, *args, **kwargs):
        return inner(*args, **kwargs)

    setattr(UnittestCompatMixin, func_name, wrapper)


for func_name in dir(django_asserts):
    if func_name.startswith("assert"):
        _patch_assert_from_django(func_name)
