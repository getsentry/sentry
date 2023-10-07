from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models.projectkey import ProjectKey
from sentry.testutils.cases import TestCase


class DynamicSdkOptions(TestCase):
    def test_default_get_dynamic_sdk_loader_option(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        assert not get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_REPLAY)
        assert not get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_PERFORMANCE)
        assert not get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_DEBUG)

    def test_get_dynamic_sdk_loader_option(self):
        dynamic_sdk_loader_options = {}
        dynamic_sdk_loader_options[DynamicSdkLoaderOption.HAS_REPLAY.value] = True
        dynamic_sdk_loader_options[DynamicSdkLoaderOption.HAS_PERFORMANCE.value] = True
        dynamic_sdk_loader_options[DynamicSdkLoaderOption.HAS_DEBUG.value] = True

        key = ProjectKey(
            project_id=1,
            public_key="public",
            secret_key="secret",
            data={"dynamicSdkLoaderOptions": dynamic_sdk_loader_options},
        )

        assert get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_REPLAY)
        assert get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_PERFORMANCE)
        assert get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_DEBUG)
