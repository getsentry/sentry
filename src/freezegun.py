from __future__ import annotations

import datetime

import time_machine


def freeze_time(t: str | datetime.datetime = "2023-09-13 01:02:00") -> time_machine.travel:
    return time_machine.travel(t, tick=False)
