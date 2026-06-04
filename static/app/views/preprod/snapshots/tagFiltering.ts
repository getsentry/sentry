import type {SidebarItem, SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

export function imageMatchesTagFilters(
  img: SnapshotImage,
  filters: Record<string, string>
): boolean {
  if (!img.tags) {
    return false;
  }
  return Object.entries(filters).every(([key, value]) => img.tags?.[key] === value);
}

export function narrowItemByTags(
  item: SidebarItem,
  filters: Record<string, string>
): SidebarItem | null {
  if (item.type === 'changed' || item.type === 'renamed') {
    const kept = item.pairs.filter(p => imageMatchesTagFilters(p.head_image, filters));
    if (kept.length === 0) {
      return null;
    }
    if (kept.length === item.pairs.length) {
      return item;
    }
    return {...item, pairs: kept};
  }
  const kept = item.images.filter(img => imageMatchesTagFilters(img, filters));
  if (kept.length === 0) {
    return null;
  }
  if (kept.length === item.images.length) {
    return item;
  }
  return {...item, images: kept};
}
