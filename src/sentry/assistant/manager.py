import six


class AssistantManager:
    def __init__(self):
        self._guides = {}

    def add(self, guides):
        for k, v in six.iteritems(guides):
            self._guides[k] = v

    def get_valid_ids(self):
        return list(v["id"] for k, v in six.iteritems(self._guides))

    def get_guide_id(self, guide):
        guide = self._guides.get(guide)
        if guide:
            return guide.get("id")

    def all(self):
        return self._guides
