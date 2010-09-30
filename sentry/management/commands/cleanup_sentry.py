from django.core.management.base import BaseCommand

from sentry.models import Message, GroupedMessage

from optparse import make_option

import datetime

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--days', action='store', dest='days'),
        make_option('--logger', action='store', dest='logger')
    )
    
    help = 'Cleans up old entries in the log.'

    def handle(self, *args, **options):
        days = 30
        if options.get('days'): # options always contain the days key
            days = int(options['days'])
        ts = datetime.datetime.now() - datetime.timedelta(days=days)
        
        base_kwargs = {}
        if options.get('logger'):
            base_kwargs['logger'] = options['logger']
        
        GroupedMessage.objects.filter(last_seen__lte=ts, **base_kwargs).delete()
        Message.objects.filter(datetime__lte=ts, **base_kwargs).delete()
