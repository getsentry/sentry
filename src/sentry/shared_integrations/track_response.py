import logging

from django.utils.functional import cached_property

from sentry.utils import metrics
from sentry.utils.decorators import classproperty


class TrackResponseMixin:
    @cached_property
    def logger(self):
        return logging.getLogger(self.log_path)

    @classproperty
    def name_field(cls):
        return "%s_name" % cls.integration_type

    @classproperty
    def name(cls):
        return getattr(cls, cls.name_field)

    def track_response_data(self, code, span, error=None, resp=None):
        metrics.incr(
            "%s.http_response" % (self.datadog_prefix),
            sample_rate=1.0,
            tags={self.integration_type: self.name, "status": code},
        )

        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(code)

        span.set_tag(self.integration_type, self.name)

        extra = {
            self.integration_type: self.name,
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info("%s.http_response" % (self.integration_type), extra=extra)
