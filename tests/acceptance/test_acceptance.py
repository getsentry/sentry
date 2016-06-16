import signal
import urllib
import os

import percy
from django.conf import settings
from selenium import webdriver
from sentry.testutils import LiveServerTestCase


class AcceptanceTest(LiveServerTestCase):
    # Use class setup/teardown to hold Selenium and Percy state across all acceptance tests.
    # For Selenium, this is done for performance to re-use the same browser across tests.
    # For Percy, this is done to call initialize and then finalize at the very end after all tests.
    #
    # TODO: if acceptance tests are split across files, this will need to be refactored into a
    # pytest plugin/fixture or something else that can manage global state.
    @classmethod
    def setUpClass(cls):
        super(AcceptanceTest, cls).setUpClass()

        # Initialize Selenium.
        # NOTE: this relies on the phantomjs binary packaged from npm to be in the right
        # location in node_modules.
        phantomjs_path = os.path.join(settings.NODE_MODULES_ROOT, 'phantomjs', 'bin', 'phantomjs')
        cls.browser = webdriver.PhantomJS(executable_path=phantomjs_path)

        # Initialize Percy.
        loader = percy.ResourceLoader(
            root_dir=settings.STATIC_ROOT,
            base_url=urllib.quote(settings.STATIC_URL),
            webdriver=cls.browser,
        )
        percy_config = percy.Config(default_widths=settings.PERCY_DEFAULT_TESTING_WIDTHS)
        cls.percy = percy.Runner(loader=loader, config=percy_config)
        cls.percy.initialize_build()

    @classmethod
    def tearDownClass(cls):
        # Teardown Selenium.
        cls.browser.close()
        # TODO: remove this when fixed in: https://github.com/seleniumhq/selenium/issues/767
        cls.browser.service.process.send_signal(signal.SIGTERM)
        cls.browser.quit()

        # Finalize Percy build.
        cls.percy.finalize_build()

        super(AcceptanceTest, cls).tearDownClass()

    def setUp(self):
        super(AcceptanceTest, self).setUp()
        # For convenience, grab a reference to the class-level webdriver and percy objects.
        self.browser = self.__class__.browser
        self.percy = self.__class__.percy

        # Clear cookies before every test. This helps avoid problems with login captchas.
        self.browser.delete_all_cookies()

    # Login helper.
    def login(self, browser, username, password):
        browser.get(self.live_server_url)
        browser.find_element_by_id('id_username').send_keys(username)
        browser.find_element_by_id('id_password').send_keys(password)
        browser.find_element_by_xpath("//button[contains(text(), 'Login')]").click()

    def test_auth_page(self):
        self.browser.get(self.live_server_url)
        self.percy.snapshot(name='login')

    def test_auth_failures(self):
        self.login(self.browser, '', '')
        self.percy.snapshot(name='login fields required')

        self.login(self.browser, 'bad-username', 'bad-username')
        self.percy.snapshot(name='login fields invalid')

    def test_new_organization(self):
        email = 'dummy@example.com'
        password = 'dummy'
        user = self.create_user(email=email)
        user.set_password(password)
        user.save()

        self.login(self.browser, email, password)
        self.percy.snapshot()
