"""
sentry.processors
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


import logging


class BaseProcessor(object):
    conditions = {}

    def post_processing(self, event):
        """
        Called every time an event is created
        """
        return

PROCESSORS_CACHE = None


def post_save_processors(sender, **kwargs):
    global PROCESSORS_CACHE

    from sentry.conf import settings

    if not settings.PROCESSORS:
        return

    if PROCESSORS_CACHE is None:
        processors = []
        for processor_ in settings.PROCESSORS:
            module_name, class_name = processor_.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                processor_class = getattr(module, class_name)
                processor_ = processor_class()
            except Exception:
                logger = logging.getLogger('sentry.errors.processors')
                logger.exception('Unable to import %s' % (processor_,))
                continue
            processors.append(processor_)
        PROCESSORS_CACHE = processors

    for processor in PROCESSORS_CACHE:
        processor.post_processing(sender)
