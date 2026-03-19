import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

/**
 * Compute badges for sidebar items.
 *
 * - Grouped changed items: "X / Y" (diffed / total in group)
 * - Individual changed items: diff percentage (e.g. "55.4%")
 * - Groups spanning multiple sections: "X / Y" (section count / total in group)
 * - Multi-image items: plain count
 */
export function computeSidebarBadges(items: SidebarItem[]): void {
  // Sum image counts per group name across all diff sections
  const groupTotals = new Map<string, number>();
  for (const item of items) {
    const count = item.type === 'changed' ? item.pairs.length : item.images.length;
    groupTotals.set(item.name, (groupTotals.get(item.name) ?? 0) + count);
  }

  for (const item of items) {
    const total = groupTotals.get(item.name) ?? 0;

    if (item.type === 'changed') {
      const isGroup = defined(item.pairs[0]?.head_image.group);
      if (isGroup) {
        const diffCount = item.pairs.filter(p => p.diff !== null && p.diff > 0).length;
        item.badge = t('%s / %s', diffCount, total);
      } else if (item.pairs.length === 1 && item.pairs[0]!.diff !== null) {
        item.badge = `${(item.pairs[0]!.diff * 100).toFixed(1)}%`;
      }
      continue;
    }

    const count = item.images.length;
    if (total > count) {
      item.badge = t('%s / %s', count, total);
    } else if (count > 1) {
      item.badge = String(count);
    }
  }
}
