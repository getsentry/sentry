from io import BytesIO
from typing import Any, Optional, Union
from urllib.parse import urljoin
from uuid import uuid4

import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.models.file import get_storage
from sentry.utils.http import absolute_uri

from .base import ChartRenderer, logger
from .types import ChartType


class Chartcuterie(ChartRenderer):
    """
    The Chartcuterie service is responsible for converting series data into a
    chart of the data as an image.

    This uses the external Chartcuterie API to produce charts
    """

    @property
    def service_url(self) -> Optional[str]:
        return options.get("chart-rendering.chartcuterie", {}).get("url")

    @property
    def storage_options(self):
        backend = options.get("chart-rendering.storage.backend")
        opts = options.get("chart-rendering.storage.options")

        # No custom storage driver configured, let get_storage fallback to default
        if not backend:
            return None

        return {"backend": backend, "options": opts}

    def validate(self) -> None:
        if not self.is_enabled():
            return

        if self.storage_options is not None and self.storage_options["options"] is None:
            raise InvalidConfiguration(
                "`chart-rendering.storage.options` must be configured if `chart-rendering.storage.backend` is configured"
            )

        if not self.service_url:
            raise InvalidConfiguration("`chart-rendering.chartcuterie.url` is not configured")

    def generate_chart(self, style: ChartType, data: Any, upload: bool = True) -> Union[str, bytes]:
        request_id = uuid4().hex

        data = {
            "requestId": request_id,
            "style": style.value,
            "data": data,
        }

        with sentry_sdk.start_span(
            op="charts.chartcuterie.generate_chart",
            description=type(self).__name__,
        ):

            resp = requests.post(
                url=urljoin(self.service_url, "render"),
                json=data,
            )

            if resp.status_code == 503 and settings.DEBUG:
                logger.info(
                    "You may need to build the chartcuterie config using `yarn build-chartcuterie-config`"
                )

            if resp.status_code != 200:
                raise RuntimeError(f"Chartcuterie responded with {resp.status_code}: {resp.text}")

        if not upload:
            return resp.content

        file_name = f"{request_id}.png"

        with sentry_sdk.start_span(
            op="charts.chartcuterie.upload",
            description=type(self).__name__,
        ):
            storage = get_storage(self.storage_options)
            storage.save(file_name, BytesIO(resp.content))
            url = absolute_uri(storage.url(file_name))

        return url
