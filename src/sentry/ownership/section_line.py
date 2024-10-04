import re


class SectionLine:
    original_line: str
    path: str = ""
    is_preserved_comment: bool
    _path_owners: list[str] = []
    _section_owners: list[str] = []
    _has_valid_path: bool

    def __init__(
        self,
        original_line: str,
        path: str,
        path_owners: list[str],
        section_owners: list[str],
    ):
        self.original_line = original_line
        self.path = path
        self.is_preserved_comment = original_line.startswith("#") or not len(original_line)
        self._path_owners = path_owners
        self._section_owners = section_owners
        self._has_valid_path = re.search(r"(\[([^]^\s]*)\])|[\s!#]", path) is None

    def get_dict_key(self) -> str:
        return self.path if self._has_valid_path else self.original_line

    def get_owners(self) -> list[str]:
        return self._path_owners if len(self._path_owners) > 0 else self._section_owners

    def should_skip(self) -> bool:
        if self.is_preserved_comment:
            return False

        if re.match(r"^\s*$", self.original_line):
            return True

        if not self._has_valid_path:
            return True

        return False
