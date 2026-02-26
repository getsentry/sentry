import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

function escapeMarkdownCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function formatBreadcrumbsAsMarkdown(crumbs: EnhancedCrumb[]): string {
  if (crumbs.length === 0) {
    return '';
  }

  const header = '| Timestamp | Type | Category | Level | Message | Data |';
  const separator = '|-----------|------|----------|-------|---------|------|';

  const rows = crumbs.map(crumb => {
    const bc = crumb.breadcrumb;
    const timestamp = bc.timestamp ? new Date(bc.timestamp).toISOString() : '';
    const type = bc.type;
    const category = bc.category ?? '';
    const message = escapeMarkdownCell(bc.message ?? '');
    const data = bc.data ? escapeMarkdownCell(JSON.stringify(bc.data)) : '';

    return `| ${timestamp} | ${type} | ${category} | ${bc.level} | ${message} | ${data} |`;
  });

  return [header, separator, ...rows].join('\n');
}

export function formatBreadcrumbsAsText(crumbs: EnhancedCrumb[]): string {
  return crumbs
    .map(crumb => {
      const lines: string[] = [];

      if (crumb.breadcrumb.timestamp) {
        lines.push(`Timestamp: ${new Date(crumb.breadcrumb.timestamp).toISOString()}`);
      }
      lines.push(`Type: ${crumb.breadcrumb.type}`);

      if (crumb.breadcrumb.category) {
        lines.push(`Category: ${crumb.breadcrumb.category}`);
      }
      lines.push(`Level: ${crumb.breadcrumb.level}`);

      if (crumb.breadcrumb.message) {
        lines.push(`Message: ${crumb.breadcrumb.message}`);
      }
      if (crumb.breadcrumb.data) {
        lines.push(`Data: ${JSON.stringify(crumb.breadcrumb.data)}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

interface CopyBreadcrumbsDropdownProps {
  breadcrumbs: EnhancedCrumb[];
}

export function CopyBreadcrumbsDropdown({breadcrumbs}: CopyBreadcrumbsDropdownProps) {
  const organization = useOrganization();

  return (
    <CopyAsDropdown
      size="xs"
      items={CopyAsDropdown.makeDefaultCopyAsOptions({
        text: () => {
          trackAnalytics('breadcrumbs.drawer.action', {
            control: 'copy',
            value: 'text',
            organization,
          });
          return formatBreadcrumbsAsText(breadcrumbs);
        },
        markdown: () => {
          trackAnalytics('breadcrumbs.drawer.action', {
            control: 'copy',
            value: 'markdown',
            organization,
          });
          return formatBreadcrumbsAsMarkdown(breadcrumbs);
        },
        json: undefined,
      })}
    />
  );
}
