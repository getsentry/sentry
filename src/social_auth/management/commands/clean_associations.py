import time
import base64

from openid.server.server import Signatory
from openid.association import Association as OIDAssociation

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Clear expired Associations instances from db'

    def handle(self, *args, **options):
        from social_auth.models import Association
        print 'Clearing expired Association instances'
        timestamp = time.time() + Signatory.SECRET_LIFETIME
        associations = Association.objects.filter(issued__lt=timestamp)
        remove = []

        for assoc in associations:
            oid = OIDAssociation(assoc.handle,
                                 base64.decodestring(assoc.secret),
                                 assoc.issued,
                                 assoc.lifetime,
                                 assoc.assoc_type)
            if oid.getExpiresIn() == 0:
                remove.append(assoc.pk)
        if remove:
            print 'Cleaning %s Associations' % len(remove)
            Association.filter(pk__in=remove).delete()
        else:
            print 'No Associations to remove'
