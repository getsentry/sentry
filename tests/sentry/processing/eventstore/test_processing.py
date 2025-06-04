from django.test import override_settings

from sentry.eventstore.processing import event_processing_store, transaction_processing_store
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.services import LazyServiceWrapper


@django_db_all
@override_settings(
    SENTRY_TRANSACTION_PROCESSING_STORE=None, SENTRY_TRANSACTION_PROCESSING_STORE_OPTIONS={}
)
def test_transaction_datastore_defaults_to_event_store():
    assert isinstance(transaction_processing_store, LazyServiceWrapper)

    assert transaction_processing_store._backend == event_processing_store._backend
    assert transaction_processing_store._options == event_processing_store._options
