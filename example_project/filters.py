from sentry.filters import SentryFilter, TextWidget

class IPFilter(SentryFilter):
    label = 'IP Address'
    column = 'data__META__REMOTE_ADDR'
    query_param = 'ip_address'
    widget = TextWidget