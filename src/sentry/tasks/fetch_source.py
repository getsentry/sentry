"""
sentry.tasks.fetch_source
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import urllib2

from celery.task import task
from sentry.utils.lrucache import lrucache

BAD_SOURCE = -1

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5


@lrucache.memoize
def fetch_url(url, logger=None):
    try:
        req = urllib2.urlopen(url)
        result = req.read()
    except Exception:
        if logger:
            logger.error('Unable to fetch remote source for %r', url, exc_info=True)
        return BAD_SOURCE
    return result


def get_source_context(source, lineno, context=LINES_OF_CONTEXT):
    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = [line.strip('\n') for line in source[lower_bound:lineno]]
    except IndexError:
        pre_context = []

    try:
        context_line = source[lineno].strip('\n')
    except IndexError:
        context_line = ''

    try:
        post_context = [line.strip('\n') for line in source[(lineno + 1):upper_bound]]
    except IndexError:
        post_context = []

    return pre_context, context_line, post_context


@task(ignore_result=True)
def fetch_javascript_source(event, **kwargs):
    from sentry.utils.cache import cache

    logger = fetch_javascript_source.get_logger()

    try:
        stacktrace = event.data['sentry.interfaces.Stacktrace']
    except KeyError:
        logger.info('No stacktrace for event %r', event.id)
        return

    # build list of frames that we can actually grab source for
    frames = [f for f in stacktrace['frames']
        if f.get('lineno') is not None and f.get('abs_path', '').startswith(('http://', 'https://'))]
    if not frames:
        logger.info('Event %r has no frames with enough context to fetch remote source', event.id)
        return

    file_list = set((f['abs_path'] for f in frames))
    source_code = {}

    for filename in file_list:
        cache_key = 'remotesource:%s' % filename
        # TODO: respect headers
        result = cache.get(cache_key)
        if result is None:
            result = fetch_url(filename)
            cache.set(cache_key, result)

        if result != BAD_SOURCE:
            result = result.splitlines()
        source_code[filename] = result

    for frame in frames:
        source = source_code[frame['abs_path']]
        if source == BAD_SOURCE:
            continue
        frame['pre_context'], frame['context_line'], frame['post_context'] = get_source_context(
            source, int(frame['lineno']))

    event.save()
