import sys
import traceback
import logging
import warnings

from django.conf import settings as dj_settings
from django.core.signals import got_request_exception
from django.db import  transaction
from django.http import Http404

from sentry import settings
from sentry.client import SentryClient
from sentry.helpers import get_installed_apps

logger = logging.getLogger('sentry')

@transaction.commit_on_success
def sentry_exception_handler(sender, request=None, **kwargs):
    try:
        exc_type, exc_value, exc_traceback = sys.exc_info()

        if not settings.CATCH_404_ERRORS \
                and issubclass(exc_type, Http404):
            return

        if dj_settings.DEBUG or getattr(exc_type, 'skip_sentry', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        # kudos to Tapz for this idea
        modules = get_installed_apps()

        # only retrive last 10 lines
        tb = traceback.extract_tb(exc_traceback)

        # retrive final file and line number where the exception occured
        file, line_number = tb[-1][:2]

        # tiny hack to get the python path from filename
        for (filename, line, function, text) in reversed(tb):
            for path in sys.path:
                if filename.startswith(path):
                    view = '%s.%s' % (filename[len(path)+1:].replace('/', '.').replace('.py', ''), function)
                    break
            if view.split('.')[0] in modules:
                break
            else:
                view = '%s.%s' % (exc_traceback.tb_frame.f_globals['__name__'], tb[-1][2]) 

        if request:
            data = dict(
                META=request.META,
                POST=request.POST,
                GET=request.GET,
                COOKIES=request.COOKIES,
            )
        else:
            data = dict()

        extra = dict(
            url=request and request.build_absolute_uri() or None,
            data=data,
            view=view,
        )

        if settings.USE_LOGGING:
            logger.critical(exc_value, exc_info=sys.exc_info(), extra=extra)
        else:
            SentryClient.create_from_exception(**extra)
    except Exception, exc:
        try:
            logger.exception(u'Unable to process log entry: %s' % (exc,))
        except Exception, exc:
            warnings.warn(u'Unable to process log entry: %s' % (exc,))

got_request_exception.connect(sentry_exception_handler)

