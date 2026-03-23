import {defined} from 'sentry/utils';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

/**
 * Compute badges for sidebar items.
 *
 * - Grouped changed items: count of variants with diffs
 * - Individual changed items: diff percentage (e.g. "55.4%")
 * - Multi-image items: plain count
 */
export function computeSidebarBadges(items: SidebarItem[]): void {
  for (const item of items) {
    if (item.type === 'changed') {
      const isGroup = defined(item.pairs[0]?.head_image.group);
      if (isGroup) {
        const diffCount = item.pairs.filter(p => p.diff !== null && p.diff > 0).length;
        item.badge = String(diffCount);
      } else if (item.pairs.length === 1 && item.pairs[0]!.diff !== null) {
        item.badge = `${(item.pairs[0]!.diff * 100).toFixed(1)}%`;
      }
      continue;
    }

    if (item.images.length > 1) {
      item.badge = String(item.images.length);
    }
  }
}
