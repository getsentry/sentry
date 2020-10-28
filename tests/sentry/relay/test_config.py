from __future__ import absolute_import

import pytest

from sentry.models import ProjectKey
from sentry.relay.config import get_project_config
from sentry.utils.safe import get_path
from sentry.testutils.helpers import Feature

PII_CONFIG = """
{
  "rules": {
    "remove_ips_and_macs": {
      "type": "multiple",
      "rules": [
        "@ip",
        "@mac"
      ],
      "hide_rule": false,
      "redaction": {
        "method": "remove"
      }
    }
  },
  "applications": {
    "$string": ["remove_ips_and_macs"]
  }
}
"""


@pytest.mark.django_db
@pytest.mark.parametrize("full", [False, True])
def test_get_project_config(default_project, insta_snapshot, full):
    # We could use the default_project fixture here, but we would like to avoid 1) hitting the db 2) creating a mock
    default_project.update_option("sentry:relay_pii_config", PII_CONFIG)
    default_project.organization.update_option("sentry:relay_pii_config", PII_CONFIG)
    keys = ProjectKey.objects.filter(project=default_project)

    cfg = get_project_config(default_project, full_config=full, project_keys=keys)
    cfg = cfg.to_dict()

    # Remove keys that change everytime
    cfg.pop("lastChange")
    cfg.pop("lastFetch")
    cfg.pop("rev")

    # public keys change every time
    assert cfg.pop("projectId") == default_project.id
    assert len(cfg.pop("publicKeys")) == len(keys)
    assert cfg.pop("organizationId") == default_project.organization.id

    insta_snapshot(cfg)


@pytest.mark.django_db
@pytest.mark.parametrize("has_custom_filters", [False, True])
def test_project_config_uses_filter_features(default_project, insta_snapshot, has_custom_filters):
    error_messages = ["some_error"]
    releases = ["1.2.3", "4.5.6"]
    default_project.update_option("sentry:error_messages", error_messages)
    default_project.update_option("sentry:releases", releases)

    with Feature({"projects:custom-inbound-filters": has_custom_filters}):
        cfg = get_project_config(default_project, full_config=True)
        cfg = cfg.to_dict()
        cfg_error_messages = get_path(cfg, "config", "filterSettings", "errorMessages")
        cfg_releases = get_path(cfg, "config", "filterSettings", "releases")

        if has_custom_filters:
            assert {"patterns": error_messages} == cfg_error_messages
            assert {"releases": releases} == cfg_releases
        else:
            assert cfg_releases is None
            assert cfg_error_messages is None
