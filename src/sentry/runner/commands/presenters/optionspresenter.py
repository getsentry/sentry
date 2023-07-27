from abc import ABC, abstractmethod


class OptionsPresenter(ABC):
    # These messages are produced more than once and referenced in tests.
    # This is the reason they are constants.
    DRIFT_MSG = "[DRIFT] Option %s drifted and cannot be updated."
    DB_VALUE = "Value of option %s on DB:"
    CHANNEL_UPDATE_MSG = "[CHANNEL UPDATE] Option %s value unchanged. Last update channel updated."
    UPDATE_MSG = "[UPDATE] Option %s updated. Old value: \n%s\nNew value: \n%s"
    SET_MSG = "[SET] Option %s set to value: \n%s"
    UNSET_MSG = "[UNSET] Option %s unset."
    DRY_RUN_MSG = "!!! Dry-run flag on. No update will be performed."

    @abstractmethod
    def error():
        pass

    @abstractmethod
    def write():
        pass
