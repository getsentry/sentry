from __future__ import absolute_import

from .base import BasePage


class TransactionSummaryPage(BasePage):
    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
