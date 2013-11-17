import time

from openid.store.nonce import SKEW

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Clear expired Nonce instances from db'

    def handle(self, *args, **options):
        from social_auth.models import Nonce
        print 'Clearing expired Nonce instances'
        qs = Nonce.objects.filter(timestamp__lt=(time.time() + SKEW))
        count = qs.count()
        if count > 0:
            print 'Cleaning %s Nonces' % qs.count()
            qs.delete()
        else:
            print 'No Nonces to remove'
