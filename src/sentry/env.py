from threading import local


class State(local):
    request = None
    data = {}


env = State()
