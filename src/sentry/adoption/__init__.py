from .manager import AdoptionManager

manager = AdoptionManager()

add = manager.add
get_by_id = manager.get_by_id
get_by_slug = manager.get_by_slug
all = manager.all
location_slugs = manager.location_slugs
integration_slugs = manager.integration_slugs
