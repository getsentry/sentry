import logging
import sys
from sentry.conf import settings
import base64
import json
import time
import hmac
import hashlib
import urllib
import urllib2

class SentryHandler(logging.Handler):

    def __init__(self, **kwargs):
        settings_kwargs = {}
        for key, name in [('server', 'REMOTE_URL'), 
                          ('client', 'CLIENT_ID'), 
                          ('psk',    'PSK')]:
            if key in kwargs:
                settings_kwargs[name] = kwargs[key]
                del kwargs[key]
        super(SentryHandler, self).__init__(**kwargs)
        settings.configure(**settings_kwargs)

    def emit(self, record):
        url = settings.REMOTE_URL
        encoded_data = base64.b64encode(json.dumps(self.format(record)).encode('zlib'))
        auth_timestamp = "%012.1f" % time.time()
        message = {
            'timestamp': auth_timestamp,
            'data': encoded_data,
            'format': 'json',
            'key': settings.CLIENT_ID,
            'authentication': hmac.new(settings.PSK, auth_timestamp + encoded_data, hashlib.sha1).hexdigest(),
            }
        try:
            data = urllib.urlencode(message)
            req = urllib2.Request(url=url, data=data)
            response = urllib2.urlopen(req)
            return response.read()
        except urllib2.HTTPError, e:
            print "SentryHandler can't emit record: %s/%s/%s" % (e, e.message, e.args)
        except urllib2.URLError, e:
            print "SentryHandler can't emit record: %s/%s/%s" % (e, e.message, e.args)

try:
    import logbook
except ImportError:
    pass
else:
    class SentryLogbookHandler(logbook.Handler):
        def emit(self, record):
            from sentry.client.models import get_client

            # Avoid typical config issues by overriding loggers behavior
            if record.name == 'sentry.errors':
                print >> sys.stderr, "Recursive log message sent to SentryHandler"
                print >> sys.stderr, record.message
                return

            kwargs = dict(
                message=record.message,
                level=record.level,
                logger=record.channel,
                data=record.extra,
            )
            client = get_client()
            if record.exc_info:
                return client.create_from_exception(record.exc_info, **kwargs)
            return client.create_from_text(**kwargs)

