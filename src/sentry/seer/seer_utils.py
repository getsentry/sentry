import enum


class FixabilityScoreThresholds(enum.Enum):
    HIGH = 0.66
    MEDIUM = 0.40
    LOW = 0.25

    def to_str(self) -> str:
        """
        Return the string representation of the fixability score threshold.
        """
        return self.name.lower()

    @classmethod
    def from_str(self, name: str) -> "FixabilityScoreThresholds | None":
        """
        Return the fixability score threshold from a string representation.
        """
        name = name.upper()
        return self[name] if name in self.__members__ else None
