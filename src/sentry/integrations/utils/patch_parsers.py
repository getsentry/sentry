import re
from abc import abstractmethod


class LanguagePatch:
    @classmethod
    @abstractmethod
    def extract_from_patch(self, patch):
        raise NotImplementedError


class PythonPatch(LanguagePatch):
    function_name_regex = r"^@@.*@@\s+def\s+(?P<fnc>.*)\(.*$"

    @classmethod
    def extract_from_patch(self, patch):
        return set(re.findall(self.function_name_regex, patch, flags=re.M))


PATCH_PARSERS = {"py": PythonPatch}
