from enum import Enum


class ReleaseActivityType(Enum):
    CREATED = 0
    DEPLOYED = 1
    FINISHED = 2
    ISSUE = 3


CHOICES = tuple(
    (i.value, i.name.lower())
    for i in [
        ReleaseActivityType.CREATED,
        ReleaseActivityType.DEPLOYED,
        ReleaseActivityType.FINISHED,
        ReleaseActivityType.ISSUE,
    ]
)
