"""
Copyright (c) 2015, Functional Software, Inc
Copyright (c) 2012, Datadog <info@datadoghq.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the Datadog nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL DATADOG BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""
from __future__ import absolute_import

__all__ = ['DatadogMetricsBackend']

import logging
import socket

from functools import wraps
from itertools import imap
from random import random
from time import time

from .base import MetricsBackend

log = logging.getLogger('dogstatsd')


class DatadogMetricsBackend(MetricsBackend):
    def __init__(self, host='localhost', port=8125, **kwargs):
        self.client = DogStatsd(host=host, port=port)
        super(DatadogMetricsBackend, self).__init__(**kwargs)

    def incr(self, key, amount=1, sample_rate=1):
        self.client.increment(self._get_key(key), amount, sample_rate=sample_rate)

    def timing(self, key, value, sample_rate=1):
        self.client.timing(self._get_key(key), value, sample_rate=sample_rate)


class DogStatsd(object):
    OK, WARNING, CRITICAL, UNKNOWN = (0, 1, 2, 3)

    def __init__(self, host='localhost', port=8125, max_buffer_size=50):
        """
        Initialize a DogStatsd object.
        >>> statsd = DogStatsd()
        :param host: the host of the DogStatsd server.
        :param port: the port of the DogStatsd server.
        :param max_buffer_size: Maximum number of metric to buffer before sending to the server if sending metrics in batch
        """
        self._host = None
        self._port = None
        self.socket = None
        self.max_buffer_size = max_buffer_size
        self._send = self._send_to_server
        self.connect(host, port)
        self.encoding = 'utf-8'

    def get_socket(self):
        '''
        Return a connected socket
        '''
        if not self.socket:
            self.connect(self._host, self._port)
        return self.socket

    def __enter__(self):
        self.open_buffer(self.max_buffer_size)
        return self

    def __exit__(self, type, value, traceback):
        self.close_buffer()

    def open_buffer(self, max_buffer_size=50):
        '''
        Open a buffer to send a batch of metrics in one packet
        You can also use this as a context manager.
        >>> with DogStatsd() as batch:
        >>>     batch.gauge('users.online', 123)
        >>>     batch.gauge('active.connections', 1001)
        '''
        self.max_buffer_size = max_buffer_size
        self.buffer = []
        self._send = self._send_to_buffer

    def close_buffer(self):
        '''
        Flush the buffer and switch back to single metric packets
        '''
        self._send = self._send_to_server
        self._flush_buffer()

    def connect(self, host, port):
        """
        Connect to the statsd server on the given host and port.
        """
        self._host = host
        self._port = int(port)
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.connect((self._host, self._port))

    def gauge(self, metric, value, tags=None, sample_rate=1):
        """
        Record the value of a gauge, optionally setting a list of tags and a
        sample rate.
        >>> statsd.gauge('users.online', 123)
        >>> statsd.gauge('active.connections', 1001, tags=["protocol:http"])
        """
        return self._report(metric, 'g', value, tags, sample_rate)

    def increment(self, metric, value=1, tags=None, sample_rate=1):
        """
        Increment a counter, optionally setting a value, tags and a sample
        rate.
        >>> statsd.increment('page.views')
        >>> statsd.increment('files.transferred', 124)
        """
        self._report(metric, 'c', value, tags, sample_rate)

    def decrement(self, metric, value=1, tags=None, sample_rate=1):
        """
        Decrement a counter, optionally setting a value, tags and a sample
        rate.
        >>> statsd.decrement('files.remaining')
        >>> statsd.decrement('active.connections', 2)
        """
        self._report(metric, 'c', -value, tags, sample_rate)

    def histogram(self, metric, value, tags=None, sample_rate=1):
        """
        Sample a histogram value, optionally setting tags and a sample rate.
        >>> statsd.histogram('uploaded.file.size', 1445)
        >>> statsd.histogram('album.photo.count', 26, tags=["gender:female"])
        """
        self._report(metric, 'h', value, tags, sample_rate)

    def timing(self, metric, value, tags=None, sample_rate=1):
        """
        Record a timing, optionally setting tags and a sample rate.
        >>> statsd.timing("query.response.time", 1234)
        """
        self._report(metric, 'ms', value, tags, sample_rate)

    def timed(self, metric, tags=None, sample_rate=1):
        """
        A decorator that will measure the distribution of a function's run
        time.  Optionally specify a list of tag or a sample rate.
        ::
            @statsd.timed('user.query.time', sample_rate=0.5)
            def get_user(user_id):
                # Do what you need to ...
                pass
            # Is equivalent to ...
            start = time.time()
            try:
                get_user(user_id)
            finally:
                statsd.timing('user.query.time', time.time() - start)
        """
        def wrapper(func):
            @wraps(func)
            def wrapped(*args, **kwargs):
                start = time()
                result = func(*args, **kwargs)
                self.timing(metric, time() - start, tags=tags,
                            sample_rate=sample_rate)
                return result
            return wrapped
        return wrapper

    def set(self, metric, value, tags=None, sample_rate=1):
        """
        Sample a set value.
        >>> statsd.set('visitors.uniques', 999)
        """
        self._report(metric, 's', value, tags, sample_rate)

    def _report(self, metric, metric_type, value, tags, sample_rate):
        if sample_rate != 1 and random() > sample_rate:
            return

        payload = [metric, ":", value, "|", metric_type]
        if sample_rate != 1:
            payload.extend(["|@", sample_rate])
        if tags:
            payload.extend(["|#", ",".join(tags)])

        encoded = "".join(imap(str, payload))
        self._send(encoded)

    def _send_to_server(self, packet):
        try:
            self.socket.send(packet.encode(self.encoding))
        except socket.error:
            log.info("Error submitting metric, will try refreshing the socket")
            self.connect(self._host, self._port)
            try:
                self.socket.send(packet.encode(self.encoding))
            except socket.error:
                log.exception("Failed to send packet with a newly binded socket")

    def _send_to_buffer(self, packet):
        self.buffer.append(packet)
        if len(self.buffer) >= self.max_buffer_size:
            self._flush_buffer()

    def _flush_buffer(self):
        self._send_to_server("\n".join(self.buffer))
        self.buffer = []

    def _escape_event_content(self, string):
        return string.replace('\n', '\\n')

    def _escape_service_check_message(self, string):
        return string.replace('\n', '\\n').replace('m:', 'm\:')

    def event(self, title, text, alert_type=None, aggregation_key=None,
              source_type_name=None, date_happened=None, priority=None,
              tags=None, hostname=None):
        """
        Send an event. Attributes are the same as the Event API.
            http://docs.datadoghq.com/api/
        >>> statsd.event('Man down!', 'This server needs assistance.')
        >>> statsd.event('The web server restarted', 'The web server is up again', alert_type='success')  # NOQA
        """
        title = self._escape_event_content(title)
        text = self._escape_event_content(text)
        string = u'_e{%d,%d}:%s|%s' % (len(title), len(text), title, text)
        if date_happened:
            string = '%s|d:%d' % (string, date_happened)
        if hostname:
            string = '%s|h:%s' % (string, hostname)
        if aggregation_key:
            string = '%s|k:%s' % (string, aggregation_key)
        if priority:
            string = '%s|p:%s' % (string, priority)
        if source_type_name:
            string = '%s|s:%s' % (string, source_type_name)
        if alert_type:
            string = '%s|t:%s' % (string, alert_type)
        if tags:
            string = '%s|#%s' % (string, ','.join(tags))

        if len(string) > 8 * 1024:
            raise Exception(u'Event "%s" payload is too big (more that 8KB), '
                            'event discarded' % title)

        try:
            self.socket.send(string.encode(self.encoding))
        except Exception:
            log.exception(u'Error submitting event "%s"' % title)

    def service_check(self, check_name, status, tags=None, timestamp=None,
                      hostname=None, message=None):
        """
        Send a service check run.
        >>> statsd.service_check('my_service.check_name', DogStatsd.WARNING)
        """
        message = self._escape_service_check_message(message) if message is not None else ''

        string = u'_sc|{0}|{1}'.format(check_name, status)

        if timestamp:
            string = u'{0}|d:{1}'.format(string, timestamp)
        if hostname:
            string = u'{0}|h:{1}'.format(string, hostname)
        if tags:
            string = u'{0}|#{1}'.format(string, ','.join(tags))
        if message:
            string = u'{0}|m:{1}'.format(string, message)

        try:
            self.socket.send(string.encode(self.encoding))
        except Exception:
            log.exception(u'Error submitting service check "{0}"'.format(check_name))
