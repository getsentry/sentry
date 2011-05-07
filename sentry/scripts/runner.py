#!/usr/bin/env python
from optparse import OptionParser
from sentry import VERSION

import sys

def cleanup(days=30, logger=None, site=None, server=None):
    from sentry.models import GroupedMessage, Message
    import datetime
    
    ts = datetime.datetime.now() - datetime.timedelta(days=days)
    
    qs = Message.objects.filter(datetime__lte=ts)
    if logger:
        qs.filter(logger=logger)
    if site:
        qs.filter(site=site)
    if server:
        qs.filter(server_name=server)
    qs.delete()
    
    # TODO: we should collect which messages above were deleted
    # and potentially just send out post_delete signals where
    # GroupedMessage can update itself accordingly
    qs = GroupedMessage.objects.filter(last_seen__lte=ts)
    if logger:
        qs.filter(logger=logger)
    qs.delete()

def main():
    args = sys.argv
    if len(args) < 2 or args[1] not in ('start', 'stop', 'cleanup'):
        print "usage: sentry [command] [options]"
        print
        print "Available subcommands:"
        print "  start"
        print "  stop"
        print "  cleanup"
        sys.exit(1)

    parser = OptionParser(version="%%prog %s" % VERSION)
    parser.add_option('--config', default='/etc/sentry.conf', metavar='CONFIG')
    if args[1] == 'start':
        parser.add_option('--host', default='0.0.0.0:8000', metavar='HOST')
    elif args[1] == 'cleanup':
        parser.add_option('--days', default='30',
                          help='Numbers of days to truncate on.')
        parser.add_option('--logger',
                          help='Limit truncation to only entries from logger.')
        parser.add_option('--site',
                          help='Limit truncation to only entries from site.')
        parser.add_option('--server',
                          help='Limit truncation to only entries from server.')

    (options, args) = parser.parse_args()
    if args[0] == "start":
        pass
    elif args[0] == "stop":
        pass
    elif args[0] == 'cleanup':
        cleanup(days=options.days, logger=options.logger, site=options.site, server=options.server)

    sys.exit(0)

if __name__ == '__main__':
    main()