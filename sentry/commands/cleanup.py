"""
sentry.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt


@options(
    opt('--days', default='30', type=int, help='Numbers of days to truncate on.'),
    opt('--logger', help='Limit truncation to only entries from logger.'),
    opt('--site', help='Limit truncation to only entries from site.'),
    opt('--server', help='Limit truncation to only entries from server.'),
    opt('--level', help='Limit truncation to only entries greater than or equal to level (e.g. DEBUG).'),
    opt('--project', type=int, help='Limit truncation to only entries from project.'),
)
def cleanup(days=30, logger=None, site=None, server=None, level=None,
            project=None):
    import logging
    from sentry.queue.tasks.cleanup import cleanup

    if level is not None and not str(level).isdigit():
        level = getattr(logging, level.upper())

    cleanup(
        days=days,
        logger=logger,
        site=site,
        server=server,
        level=level,
        project=project
    )
