import time


class Worker:
    def __init__(self, **options):
        self.options = options
        self.exitcode = None

    def start(self) -> None:
        try:
            while True:
                time.sleep(1)
                print("Checking for tasks")
        except KeyboardInterrupt:
            self.exitcode = 1
