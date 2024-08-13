from django.core.exceptions import FieldDoesNotExist
from django.db.models import Q
from django.http import JsonResponse


class ListFilterMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if hasattr(response, "data") and isinstance(response.data, list):
            view = request.resolver_match.func.view_class()
            # print(view)
            # print(response.data)
            model = view.queryset.model if hasattr(view, "queryset") else None

            if model:
                filters = Q()
                for key, value in request.GET.items():
                    try:
                        # field = model._meta.get_field(key)
                        filters &= Q(**{key: value})
                    except FieldDoesNotExist:
                        continue

                queryset = view.queryset.filter(filters)
                serializer = view.get_serializer(queryset, many=True)
                return JsonResponse(serializer.data, safe=False)

        return response
