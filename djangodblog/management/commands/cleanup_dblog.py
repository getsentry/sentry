from django.core.management.base import CommandError, BaseCommand

from djangodblog.models import Error, ErrorBatch

from optparse import make_option

import datetime

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--days', action='store', dest='days'),
        make_option('--logger', action='store', dest='logger')
    )
    
    help = 'Cleans up old entries in the log.'

    def handle(self, *args, **options):
        ts = datetime.datetime.now() - datetime.timedelta(days=options.get('days', 30))
        
        base_kwargs = {}
        if options.get('logger'):
            base_kwargs['logger'] = options['logger']
        
        ErrorBatch.objects.filter(last_seen__lte=ts, **base_kwargs).delete()
        Error.objects.filter(datetime__lte=ts, **base_kwargs).delete()