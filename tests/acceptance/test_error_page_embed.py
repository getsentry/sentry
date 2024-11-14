from urllib.parse import quote
from uuid import uuid4

from django.urls import reverse

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class ErrorPageEmbedTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.key = self.create_project_key(project=self.project)
        self.event_id = uuid4().hex
        self.path = "{}?eventId={}&dsn={}".format(
            reverse("sentry-error-page-embed"),
            quote(self.event_id),
            quote(self.key.dsn_public),
        )

    def wait_for_error_page_embed(self):
        script = f"""
            const script = window.document.createElement('script');
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.src = '{self.path}';
            const injectionPoint = window.document.head || window.document.body;
            injectionPoint.appendChild(script);

            window.addEventListener('message', (event) => {{
                window.__error_page_embed_received_message__ = event.data;
            }});
        """
        self.browser.driver.execute_script(script)
        self.browser.wait_until(".sentry-error-embed")

    def wait_for_reportdialog_closed_message(self):
        self.browser.wait_until_script_execution(
            """return window.__error_page_embed_received_message__ === '__sentry_reportdialog_closed__'"""
        )

    def test_closed_message_received_on_close_button_click(self):
        self.wait_for_error_page_embed()
        self.browser.click(".sentry-error-embed button.close")
        self.wait_for_reportdialog_closed_message()

    def test_closed_message_received_on_outside_click(self):
        # in order to click outside we need to set a sufficiently large window size
        with self.browser.full_viewport(width=900, height=1330, fit_content=False):
            self.wait_for_error_page_embed()
            self.browser.click("body")
            self.wait_for_reportdialog_closed_message()
