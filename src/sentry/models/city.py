from __future__ import absolute_import

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.utils.gis import geocode


class City(Model):
    __core__ = True

    country = models.CharField(max_length=2)
    region = models.CharField(max_length=128, default='')
    name = models.CharField(max_length=128)
    lat = models.FloatField()
    lng = models.FloatField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_city'
        unique_together = (('country', 'region', 'name'),)

    __repr__ = sane_repr('country', 'region', 'name')

    @classmethod
    def from_ip_address(cls, ip_address):
        location = geocode(ip_address)
        if not location:
            return None
        return City.objects.get_or_create(
            country=location['country'],
            region=location['region'],
            name=location['city'],
            defaults={
                'lat': location['lat'],
                'lng': location['lng'],
            }
        )[0]
