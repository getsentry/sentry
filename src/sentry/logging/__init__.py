from structlog import get_logger


class LoggingFormat:
    HUMAN = "human"
    MACHINE = "machine"


def bind(name, **kwargs):
    """
    Syntactic sugar for binding arbitrary kv pairs to a given logger instantiated from
    logging.getLogger instead of structlog.get_logger.
    """
    return get_logger(name=name).bind(**kwargs)


def unbind(name, *keys):
    try:
        get_logger(name=name).unbind(*keys)
    except KeyError:
        pass
