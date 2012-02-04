def index_event(event, **kwargs):
    from sentry.models import SearchDocument

    SearchDocument.objects.index(event)
