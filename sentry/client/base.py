"""
sentry.client.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import base64
import datetime
import functools
import logging
import sys
import time
import traceback
import urllib2
import uuid
import warnings

from django.core.cache import cache
from django.http import HttpRequest
from django.template import TemplateSyntaxError
from django.template.loader import LoaderOrigin

import sentry
from sentry.conf import settings
from sentry.utils import json
from sentry.utils import construct_checksum, transform, get_installed_apps, force_unicode, \
                           get_versions, shorten, get_signature, get_auth_header, varmap
from sentry.utils.stacks import get_stack_info, iter_stack_frames, iter_traceback_frames

warnings.warn('sentry.client will be removed in version 1.14.0. You should switch to raven.client.django', DeprecationWarning)

logger = logging.getLogger('sentry.errors')

def fail_silently(default=None):
    def wrapped(func):
        @functools.wraps(func)
        def _wrapped(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception, e:
                logger.exception(e)
                return default
        return _wrapped
    return wrapped

class SentryClient(object):
    @fail_silently((False, None))
    def check_throttle(self, checksum):
        if not (settings.THRASHING_TIMEOUT and settings.THRASHING_LIMIT):
            return (False, None)

        cache_key = 'sentry:%s' % (checksum,)
        # We MUST do a get first to avoid re-setting the timeout when doing .add
        added = cache.get(cache_key) is None
        if added:
            # Use add to avoid race conditions
            added = cache.add(cache_key, 1, settings.THRASHING_TIMEOUT)

        if added:
            return (False, None)

        try:
            thrash_count = cache.incr(cache_key)
        except (KeyError, ValueError):
            # cache.incr can fail. Assume we aren't thrashing yet, and
            # if we are, hope that the next error has a successful
            # cache.incr call.
            thrash_count = 0

        if thrash_count > settings.THRASHING_LIMIT:
            return (True, self.get_last_message_id(checksum))

        return (False, None)

    @fail_silently()
    def get_last_message_id(self, checksum):
        cache_key = 'sentry:%s:last_message_id' % (checksum,)

        return cache.get(cache_key)

    @fail_silently()
    def set_last_message_id(self, checksum, message_id):
        if settings.THRASHING_TIMEOUT and settings.THRASHING_LIMIT:
            cache_key = 'sentry:%s:last_message_id' % (checksum,)

            cache.set(cache_key, message_id, settings.THRASHING_LIMIT + 5)

    def process(self, **kwargs):
        "Processes the message before passing it on to the server"
        from sentry.utils import get_filters

        if kwargs.get('data'):
            # Ensure we're not changing the original data which was passed
            # to Sentry
            kwargs['data'] = kwargs['data'].copy()
        else:
            kwargs['data'] = {}

        if '__sentry__' not in kwargs['data']:
            kwargs['data']['__sentry__'] = {}

        request = kwargs.pop('request', None)
        if isinstance(request, HttpRequest):
            try:
                post_data = not request.POST and request.raw_post_data or request.POST
            except:
                post_data = request.POST

            kwargs['data'].update(dict(
                META=request.META,
                POST=post_data,
                GET=request.GET,
                COOKIES=request.COOKIES,
            ))

            if hasattr(request, 'user'):
                if request.user.is_authenticated():
                    user_info = {
                        'is_authenticated': True,
                        'id': request.user.pk,
                        'username': request.user.username,
                        'email': request.user.email,
                    }
                else:
                    user_info = {
                        'is_authenticated': False,
                    }

                kwargs['data']['__sentry__']['user'] = user_info

            if not kwargs.get('url'):
                kwargs['url'] = request.build_absolute_uri()

        kwargs.setdefault('level', logging.ERROR)
        kwargs.setdefault('server_name', settings.NAME)

        versions = get_versions()
        kwargs['data']['__sentry__']['versions'] = versions

        # Shorten lists/strings
        for k, v in kwargs['data'].iteritems():
            if k == '__sentry__':
                continue
            kwargs['data'][k] = shorten(v)

        # if we've passed frames, lets try to fetch the culprit
        if not kwargs.get('view') and kwargs['data']['__sentry__'].get('frames'):
            # This should be cached
            modules = get_installed_apps()
            if settings.INCLUDE_PATHS:
                modules = set(list(modules) + settings.INCLUDE_PATHS)

            def contains(iterator, value):
                for k in iterator:
                    if value.startswith(k):
                        return True
                return False

            # We iterate through each frame looking for an app in INSTALLED_APPS
            # When one is found, we mark it as last "best guess" (best_guess) and then
            # check it against SENTRY_EXCLUDE_PATHS. If it isnt listed, then we
            # use this option. If nothing is found, we use the "best guess".
            best_guess = None
            view = None
            for frame in kwargs['data']['__sentry__']['frames']:
                try:
                    view = '.'.join([frame['module'], frame['function']])
                except:
                    continue
                if contains(modules, view):
                    if not (contains(settings.EXCLUDE_PATHS, view) and best_guess):
                        best_guess = view
                elif best_guess:
                    break
            if best_guess:
                view = best_guess

            if view:
                kwargs['view'] = view

        # try to fetch the current version
        if kwargs.get('view'):
            # get list of modules from right to left
            parts = kwargs['view'].split('.')
            module_list = ['.'.join(parts[:idx]) for idx in xrange(1, len(parts) + 1)][::-1]
            version = None
            module = None
            for m in module_list:
                if m in versions:
                    module = m
                    version = versions[m]

            # store our "best guess" for application version
            if version:
                kwargs['data']['__sentry__'].update({
                    'version': version,
                    'module': module,
                })

        if 'checksum' not in kwargs:
            checksum = construct_checksum(**kwargs)
        else:
            checksum = kwargs['checksum']

        (is_thrashing, message_id) = self.check_throttle(checksum)

        if is_thrashing:
            if request and message_id:
                # attach the sentry object to the request
                request.sentry = {
                    'id': '%s$%s' % (message_id, checksum),
                    'thrashed': True,
                }

            return message_id

        for filter_ in get_filters():
            kwargs = filter_(None).process(kwargs) or kwargs

        # create ID client-side so that it can be passed to application
        message_id = uuid.uuid4().hex
        kwargs['message_id'] = message_id

        # Make sure all data is coerced
        kwargs['data'] = transform(kwargs['data'])

        if 'timestamp' not in kwargs:
            kwargs['timestamp'] = datetime.datetime.now()

        self.send(**kwargs)

        if request:
            # attach the sentry object to the request
            request.sentry = {
                'id': '%s$%s' % (message_id, checksum),
                'thrashed': False,
            }

        # store the last message_id incase we hit thrashing limits
        self.set_last_message_id(checksum, message_id)

        return message_id

    def send_remote(self, url, data, headers={}):
        req = urllib2.Request(url, headers=headers)
        try:
            response = urllib2.urlopen(req, data, settings.REMOTE_TIMEOUT).read()
        except:
            response = urllib2.urlopen(req, data).read()
        return response

    def send(self, **kwargs):
        "Sends the message to the server."
        if settings.SERVERS:
            message = base64.b64encode(json.dumps(kwargs).encode('zlib'))
            for url in settings.SERVERS:
                timestamp = time.time()
                signature = get_signature(message, timestamp)
                headers = {
                    'Authorization': get_auth_header(signature, timestamp, '%s/%s' % (self.__class__.__name__, sentry.VERSION)),
                    'Content-Type': 'application/octet-stream',
                }

                try:
                    return self.send_remote(url=url, data=message, headers=headers)
                except urllib2.HTTPError, e:
                    body = e.read()
                    logger.error('Unable to reach Sentry log server: %s (url: %%s, body: %%s)' % (e,), url, body,
                                 exc_info=True, extra={'data': {'body': body, 'remote_url': url}})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
                except urllib2.URLError, e:
                    logger.error('Unable to reach Sentry log server: %s (url: %%s)' % (e,), url,
                                 exc_info=True, extra={'data': {'remote_url': url}})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
        else:
            from sentry.models import GroupedMessage

            return GroupedMessage.objects.from_kwargs(**kwargs)

    def create_from_record(self, record, **kwargs):
        """
        Creates an error log for a ``logging`` module ``record`` instance.
        """
        for k in ('url', 'view', 'request', 'data'):
            if not kwargs.get(k):
                kwargs[k] = record.__dict__.get(k)

        kwargs.update({
            'logger': record.name,
            'level': record.levelno,
            'message': force_unicode(record.msg),
            'server_name': settings.NAME,
        })

        # construct the checksum with the unparsed message
        kwargs['checksum'] = construct_checksum(**kwargs)

        # save the message with included formatting
        kwargs['message'] = record.getMessage()

        # If there's no exception being processed, exc_info may be a 3-tuple of None
        # http://docs.python.org/library/sys.html#sys.exc_info
        if record.exc_info and all(record.exc_info):
            return self.create_from_exception(record.exc_info, **kwargs)

        data = kwargs.pop('data', {}) or {}
        data['__sentry__'] = {}
        if getattr(record, 'stack', settings.AUTO_LOG_STACKS):
            stack = []
            found = None
            for frame in iter_stack_frames():
                # There are initial frames from Sentry that need skipped
                name = frame.f_globals.get('__name__')
                if found is None:
                    if name == 'logging':
                        found = False
                    continue
                elif not found:
                    if name != 'logging':
                        found = True
                    else:
                        continue
                stack.append(frame)
            data['__sentry__']['frames'] = varmap(shorten, get_stack_info(stack))

        return self.process(
            traceback=record.exc_text,
            data=data,
            **kwargs
        )

    def create_from_text(self, message, **kwargs):
        """
        Creates an error log for from ``message``.
        """
        return self.process(
            message=message,
            **kwargs
        )

    def create_from_exception(self, exc_info=None, **kwargs):
        """
        Creates an error log from an exception.
        """
        new_exc = bool(exc_info)
        if not exc_info or exc_info is True:
            exc_info = sys.exc_info()

        data = kwargs.pop('data', {}) or {}

        try:
            exc_type, exc_value, exc_traceback = exc_info

            frames = varmap(shorten, get_stack_info(iter_traceback_frames(exc_traceback)))

            if hasattr(exc_type, '__class__'):
                exc_module = exc_type.__class__.__module__
            else:
                exc_module = None

            data['__sentry__'] = {}
            data['__sentry__']['frames'] = frames
            data['__sentry__']['exception'] = [exc_module, exc_value.args]

            # As of r16833 (Django) all exceptions may contain a ``django_template_source`` attribute (rather than the
            # legacy ``TemplateSyntaxError.source`` check) which describes template information.
            if hasattr(exc_value, 'django_template_source') or ((isinstance(exc_value, TemplateSyntaxError) and \
                isinstance(getattr(exc_value, 'source', None), (tuple, list)) and isinstance(exc_value.source[0], LoaderOrigin))):
                origin, (start, end) = getattr(exc_value, 'django_template_source', exc_value.source)
                data['__sentry__']['template'] = (origin.reload(), start, end, origin.name)
                kwargs['view'] = origin.loadname

            tb_message = '\n'.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

            kwargs.setdefault('message', transform(force_unicode(exc_value)))

            return self.process(
                class_name=exc_type.__name__,
                traceback=tb_message,
                data=data,
                **kwargs
            )
        finally:
            if new_exc:
                try:
                    del exc_info
                except Exception, e:
                    logger.exception(e)

class DummyClient(SentryClient):
    "Sends messages into an empty void"
    def send(self, **kwargs):
        return None
