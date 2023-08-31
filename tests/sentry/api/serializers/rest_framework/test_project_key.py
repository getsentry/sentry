from sentry.api.serializers.rest_framework import DynamicSdkLoaderOptionSerializer
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption
from sentry.testutils.cases import TestCase


class ProjectKeySerializerTest(TestCase):
    def test_dynamic_sdk_serializer_attrs(self):
        s = DynamicSdkLoaderOptionSerializer()
        assert set(s.fields.keys()) == {option.value for option in DynamicSdkLoaderOption}
