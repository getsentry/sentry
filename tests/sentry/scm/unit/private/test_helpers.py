from unittest import mock

from sentry.integrations.perforce.client import PerforceClient
from sentry.scm.private.helpers import _perforce_provider


def test_perforce_provider_is_none_when_sentry_scm_predates_it():
    # A top-level import of the provider raises at Django startup against a pinned
    # sentry-scm without it, taking down every SCM path rather than just Perforce.
    with mock.patch(
        "sentry.scm.private.helpers.importlib.import_module",
        side_effect=ModuleNotFoundError("No module named 'scm.providers.perforce'"),
    ):
        client = mock.Mock(spec=PerforceClient)
        assert _perforce_provider(client, 1, mock.Mock()) is None


def test_perforce_provider_is_none_for_a_non_perforce_client():
    assert _perforce_provider(mock.Mock(), 1, mock.Mock()) is None
