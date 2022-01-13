from bs4 import BeautifulSoup

from sentry.shared_integrations.response.base import BaseApiResponse


class XmlApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.xml = BeautifulSoup(text, "xml")
        super().__init__(*args, **kwargs)
