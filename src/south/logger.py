import sys
import logging
from django.conf import settings

# Create a dummy handler to use for now.
class NullHandler(logging.Handler):
    def emit(self, record):
        pass

def get_logger():
    "Attach a file handler to the logger if there isn't one already."
    debug_on = getattr(settings, "SOUTH_LOGGING_ON", False)
    logging_file = getattr(settings, "SOUTH_LOGGING_FILE", False)
    
    if debug_on:
        if logging_file:
            if len(_logger.handlers) < 2:
                _logger.addHandler(logging.FileHandler(logging_file))
                _logger.setLevel(logging.DEBUG)
        else:
            raise IOError("SOUTH_LOGGING_ON is True. You also need a SOUTH_LOGGING_FILE setting.")
    
    return _logger

def close_logger():
    "Closes the logger handler for the file, so we can remove the file after a test."
    for handler in _logger.handlers:
        _logger.removeHandler(handler)
        if isinstance(handler, logging.FileHandler):
            handler.close()

def init_logger():
    "Initialize the south logger"
    logger = logging.getLogger("south")
    logger.addHandler(NullHandler())
    return logger

_logger = init_logger()
