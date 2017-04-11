from __future__ import absolute_import

from datetime import timedelta
from django.db.models import Count
from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import City, GroupLocation


class ProjectLocationsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = GroupLocation.objects.filter(
            project_id=project.id,
            date_added__gte=timezone.now() - timedelta(days=30),
        ).values(
            'city_id',
        ).annotate(
            count=Count('city_id'),
        ).values_list('city_id', 'count')

        cities = {
            c.id: c for c in City.objects.filter(
                id__in=[q[0] for q in queryset],
            )
        }

        result = []
        for city_id, count in queryset:
            try:
                city = cities[city_id]
            except KeyError:
                continue
            result.append({
                'city': city.name,
                'region': city.region,
                'country': city.country,
                'lat': city.lat,
                'lng': city.lng,
                'count': count
            })

        return Response(result)
