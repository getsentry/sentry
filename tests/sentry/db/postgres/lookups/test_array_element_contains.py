import pytest
from django.contrib.postgres.fields import ArrayField as DjangoArrayField
from django.db import models


class ArrayElementContainsLookupTestModel(models.Model):
    id = models.AutoField(primary_key=True)
    array_field = DjangoArrayField(models.TextField(), null=True)

    class Meta:
        app_label = "fixtures"


@pytest.fixture
def array_element_contains_db():
    ArrayElementContainsLookupTestModel.objects.bulk_create(
        [
            ArrayElementContainsLookupTestModel(array_field=["foo", "bar", "baz"]),
            ArrayElementContainsLookupTestModel(array_field=["foo", "bar"]),
            ArrayElementContainsLookupTestModel(array_field=[]),
            ArrayElementContainsLookupTestModel(array_field=None),
        ]
    )
    yield
    ArrayElementContainsLookupTestModel.objects.all().delete()


@pytest.mark.django_db
def test_basic_usage_for_array_field(array_element_contains_db):
    assert (
        ArrayElementContainsLookupTestModel.objects.filter(
            array_field__element_contains="foo"
        ).count()
        == 2
    )

    result = ArrayElementContainsLookupTestModel.objects.filter(array_field__element_contains="baz")
    assert len(result) == 1
    assert result[0].array_field == ["foo", "bar", "baz"]

    assert (
        ArrayElementContainsLookupTestModel.objects.filter(
            array_field__element_contains="qux"
        ).count()
        == 0
    )

    assert (
        ArrayElementContainsLookupTestModel.objects.filter(array_field__element_contains="").count()
        == 2
    )  # only non empty arrays are considered, and it's elements are checked if they contain ''
