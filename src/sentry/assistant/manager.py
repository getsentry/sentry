class AssistantManager:
    def __init__(self):
        self._guides = {}

    def add(self, guides):
        for guide_key, id in guides.items():
            self._guides[guide_key] = id

    def get_valid_ids(self):
        return list(self._guides.values())

    def get_guide_id(self, guide):
        return self._guides.get(guide)

    def all(self):
        return self._guides
