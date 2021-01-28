class EventTypeManager:
    def __init__(self):
        self.__values = []
        self.__lookup = {}

    def __iter__(self):
        return self.__values.values()

    def __contains__(self, key):
        return key in self.__lookup

    def get(self, key, **kwargs):
        return self.__lookup[key]

    def exists(self, key):
        return key in self.__lookup

    def register(self, cls):
        self.__values.append(cls)
        self.__lookup[cls.key] = cls
