from __future__ import absolute_import


class BasePage(object):
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
        raise NotImplementedError


class BaseElement(object):
    def __init__(self, selector, element):
        self.selector = selector
        self.element = element

    def assert_appearance(self, *args, **kwargs):
        pass


class ButtonElement(BaseElement):
    label_attr = 'aria-label'
    disabled_attr = 'aria-disabled'

    def assert_diabled(self, is_disabled=False):
        disabled = 'true' if is_disabled else 'false'
        assert self.element.get_attribute(self.disabled_attr) == disabled

    def assert_label(self, label):
        assert self.element.get_attribute(self.label_attr) == label

    def click(self):
        self.element.click()

    def assert_appearance(self, label, is_disabled=False, *args, **kwargs):
        self.assert_label(label)
        self.assert_diabled(is_disabled)


class ButtonWithIconElement(ButtonElement):
    def assert_icon(self, icon):
        icon = self.element.find_element_by_tag_name('use')
        assert icon.get_attribute('href') == icon

    def assert_appearance(self, icon, *args, **kwargs):
        super(ButtonWithIconElement, self).assert_appearance(*args, **kwargs)
        self.assert_icon(icon)


class TextBoxElement(BaseElement):
    pass


class ModalElement(BaseElement):
    pass
