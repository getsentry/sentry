from __future__ import absolute_import

from .manager import AssistantManager
from .guides import GUIDES

manager = AssistantManager()
manager.add(GUIDES)
