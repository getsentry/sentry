from django.core.management.base import CommandError, BaseCommand

from djangodblog.models import Error, ErrorBatch

from optparse import make_option

import datetime

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--days', action='store',  dest='cutoff'),
    )
    
    help = 'Cleans up old entries in the log.'

    def handle(self, *args, **options):
        ts = datetime.datetime.now() - datetime.timedelta(days=options.get('days', 30))
        
        ErrorBatch.objects.filter(last_seen__lte=ts).delete()
        Error.objects.filter(datetime__lte=ts).delete()