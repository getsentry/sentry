import logging

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from sentry.models.sentryshot import SentryShot

MAX_WAIT_TIME = 5
logger = logging.getLogger("service:sentryshot")


class SentryShotService:
    def __init__(self, uuid: str):
        self.sentryshot = SentryShot.objects.filter(uuid=uuid).first()

    def _start(self):
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        self.driver = webdriver.Chrome(options=chrome_options)

    def generate_screenshot(self):
        # TODO: @athena check gcs first to see if the image is already generated
        try:
            self._start()
            # TODO: @athena sign the url so it can access all sentry orgs
            self.driver.get(self.sentryshot.sentry_url)
            WebDriverWait(self.driver, MAX_WAIT_TIME).until(
                EC.presence_of_element_located(
                    (By.CLASS_NAME, self.sentryshot.component_identifier)
                )
            )

            # TODO: @athena store screenshot in gcs
            # screenshot_path = "screenshot.png"
            # component_element.screenshot(screenshot_path)
            success = True
        except Exception as e:
            logger.exception(
                "Failed to generate screenshot",
                extra={"exception": e, "uuid": self.sentryshot.uuid},
            )
            success = False

        if self.driver:
            self.driver.quit()
        return success
