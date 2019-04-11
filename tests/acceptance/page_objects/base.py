from __future__ import absolute_import


class BasePage(object):
    """Base class for PageObjects"""
    page_name = 'base'

    def __init__(self, browser):
        self.browser = browser
        try:
            self.assert_correct_page()
        except AssertionError:
            raise Exception(
                'This is not the %s page. Current url is %s.' %
                (self.page_name, self.driver.current_url))

    @property
    def driver(self):
        return self.browser.driver

    def assert_correct_page(self):
        pass


class BaseElement(object):
    def __init__(self, selector, element):
        self.selector = selector
        self.element = element


class ButtonElement(BaseElement):
    label_attr = 'aria-label'
    disabled_attr = 'aria-disabled'

    def get_diabled(self):
        return self.element.get_attribute(self.disabled_attr)

    def get_label(self):
        return self.element.get_attribute(self.label_attr)

    def click(self):
        self.element.click()


class ButtonWithIconElement(ButtonElement):
    def get_icon_href(self):
        return self.element.find_element_by_tag_name('use').get_attribute('href')


class TextBoxElement(BaseElement):
    pass


class ModalElement(BaseElement):
    pass
