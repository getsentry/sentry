from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import City, EventUserLocation


@register(EventUserLocation)
class EventUserLocationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        cities = {
            c.id: c for c in City.objects.filter(
                id__in=[i.city_id for i in item_list],
            )
        }
        attrs = {}
        for item in item_list:
            attrs[item] = {
                'city': cities.get(item.city_id),
            }
        return attrs

    def serialize(self, obj, attrs, user):
        data = {
            'count': obj.times_seen,
            'lastSeen': obj.first_seen,
            'firstSeen': obj.first_seen,
        }
        city = attrs['city']
        if city:
            data.update({
                'city': city.name,
                'country': city.country,
                'region': city.region,
                'lat': city.lat,
                'lng': city.lng,
            })
        else:
            data.update({
                'city': None,
                'country': None,
                'region': None,
                'lat': None,
                'lng': None,
            })
        return data
