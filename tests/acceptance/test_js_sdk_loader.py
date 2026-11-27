from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

# Stands in for the CDN bundle, so that the test doesn't depend on the network.
SDK_URL = "data:text/javascript,window.Sentry.init=function(){window.__sdk_initialized__=true}"


@no_silo_test
@override_settings(JS_SDK_LOADER_SDK_VERSION="11.0.0", JS_SDK_LOADER_DEFAULT_SDK_URL=SDK_URL)
class JavaScriptSdkLoaderTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.key = self.create_project_key(project=self.create_project())

    def load_sdk(self, csp: str, minified: bool = False) -> None:
        args = [self.key.public_key, ".min"] if minified else [self.key.public_key]
        self.browser.driver.execute_script(
            """
            const [path, csp] = arguments;

            const script = document.createElement('script');
            script.src = path;
            script.dataset.lazy = 'no';
            document.head.appendChild(script);

            // The policy has to be applied after setting `script.src` above,
            // but still takes effect before the loader runs.
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = csp;
            document.head.appendChild(meta);
            """,
            reverse("sentry-js-sdk-loader", args=args),
            csp,
        )
        self.browser.wait_until_script_execution("return window.__sdk_initialized__ === true")

    def is_script_src_blocked(self) -> bool:
        return self.browser.driver.execute_script(
            """
            try {
                document.createElement('script').src = 'data:text/javascript,';
                return false;
            } catch (e) {
                return true;
            }
            """
        )

    def test_enforced_trusted_types(self) -> None:
        self.load_sdk("require-trusted-types-for 'script'; trusted-types sentry-loader")
        assert self.is_script_src_blocked()

    def test_enforced_trusted_types_minified(self) -> None:
        self.load_sdk(
            "require-trusted-types-for 'script'; trusted-types sentry-loader", minified=True
        )
        assert self.is_script_src_blocked()

    def test_falls_back_to_plain_url_if_policy_is_not_allowed(self) -> None:
        self.load_sdk("trusted-types 'none'")
        assert not self.is_script_src_blocked()
