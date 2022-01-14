from sentry.shared_integrations.response.base import BaseApiResponse


class TextApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.text = text
        super().__init__(*args, **kwargs)
