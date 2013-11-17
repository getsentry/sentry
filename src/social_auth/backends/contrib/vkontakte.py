import warnings

warnings.warn('Vkontakte backend was renamed to vk backend, settings were renamed too. Please adjust your settings', DeprecationWarning)
from .vk import *
