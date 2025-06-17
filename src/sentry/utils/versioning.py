from sentry.exceptions import InvalidConfiguration
from sentry.utils import warnings


class Version(tuple[int, ...]):
    def __str__(self) -> str:
        return ".".join(map(str, self))


def summarize(sequence: list[str], max: int = 3) -> list[str]:
    items = sequence[:max]
    remainder = len(sequence) - max
    if remainder == 1:
        items.append("and one other")
    elif remainder > 1:
        items.append(f"and {remainder} others")
    return items


def make_upgrade_message(
    service: str, modality: str, version: Version, hosts: dict[str, Version]
) -> str:
    return "{service} {modality} be upgraded to {version} on {hosts}.".format(
        hosts=",".join(summarize(list(hosts), 2)),
        modality=modality,
        service=service,
        version=version,
    )


def check_versions(
    service: str,
    versions: dict[str, Version],
    required: Version,
    recommended: Version | None = None,
) -> None:
    """
    Check that hosts fulfill version requirements.

    :param service: service label, such as ``Redis``
    :param versions: mapping of host to ``Version``
    :param required: lowest supported ``Version``. If any host does not fulfill
        this requirement, an ``InvalidConfiguration`` exception is raised.
    :param recommended: recommended version. If any host does not fulfill this
        requirement, a ``PendingDeprecationWarning`` is raised.
    """
    # x = (host, version)
    must_upgrade = dict([x for x in versions.items() if required > x[1]])
    if must_upgrade:
        raise InvalidConfiguration(make_upgrade_message(service, "must", required, must_upgrade))

    if recommended:
        # x = (host, version)
        should_upgrade = dict([x for x in versions.items() if recommended > x[1]])
        if should_upgrade:
            warnings.warn(
                make_upgrade_message(service, "should", recommended, should_upgrade),
                PendingDeprecationWarning,
            )
