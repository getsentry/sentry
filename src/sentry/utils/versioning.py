from __future__ import absolute_import

from sentry.exceptions import InvalidConfiguration
from sentry.utils import warnings


class Version(tuple):
    def __str__(self):
        return '.'.join(map(str, self))


def summarize(sequence, max=3):
    items = sequence[:max]
    remainder = len(sequence) - max
    if remainder == 1:
        items.append('and one other')
    elif remainder > 1:
        items.append('and %s others' % (remainder,))
    return items


def make_upgrade_message(service, modality, version, hosts):
    return '{service} {modality} be upgraded to {version} on {hosts}.'.format(
        hosts=','.join(map(str, summarize(hosts.keys(), 2))),
        modality=modality,
        service=service,
        version=version,
    )


def check_versions(service, versions, required, recommended=None):
    """
    Check that hosts fulfill version requirements.

    :param service: service label, such as ``Redis``
    :param versions: mapping of host to ``Version``
    :param required: lowest supported ``Version``. If any host does not fulfill
        this requirement, an ``InvalidConfiguration`` exception is raised.
    :param recommended: recommended version. If any host does not fulfill this
        requirement, a ``PendingDeprecationWarning`` is raised.
    """
    must_upgrade = dict(filter(lambda (host, version): required > version, versions.items()))
    if must_upgrade:
        raise InvalidConfiguration(make_upgrade_message(service, 'must', required, must_upgrade))

    if recommended:
        should_upgrade = dict(filter(lambda (host, version): recommended > version, versions.items()))
        if should_upgrade:
            warnings.warn(
                make_upgrade_message(service, 'should', recommended, should_upgrade),
                PendingDeprecationWarning,
            )
