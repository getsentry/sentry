import {useCallback} from 'react';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
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
  borderless?: boolean;
}

export function CopyBreadcrumbsDropdown({
  breadcrumbs,
  borderless,
}: CopyBreadcrumbsDropdownProps) {
  const {copy} = useCopyToClipboard();
  const organization = useOrganization();

  const handleCopyAsMarkdown = useCallback(() => {
    const markdown = formatBreadcrumbsAsMarkdown(breadcrumbs);
    copy(markdown, {
      successMessage: t('Copied breadcrumbs to clipboard'),
      errorMessage: t('Failed to copy breadcrumbs'),
    });
    trackAnalytics('breadcrumbs.drawer.action', {
      control: 'copy',
      value: 'markdown',
      organization,
    });
  }, [copy, breadcrumbs, organization]);

  const handleCopyAsText = useCallback(() => {
    const text = formatBreadcrumbsAsText(breadcrumbs);
    copy(text, {
      successMessage: t('Copied breadcrumbs to clipboard'),
      errorMessage: t('Failed to copy breadcrumbs'),
    });
    trackAnalytics('breadcrumbs.drawer.action', {
      control: 'copy',
      value: 'text',
      organization,
    });
  }, [copy, breadcrumbs, organization]);

  return (
    <DropdownMenu
      size="xs"
      triggerProps={{
        title: t('Copy Breadcrumbs'),
        icon: <IconCopy />,
        size: 'xs',
        borderless,
        showChevron: false,
      }}
      menuTitle={t('Copy Breadcrumbs')}
      items={[
        {
          key: 'copy-text',
          label: t('Copy as Text'),
          onAction: handleCopyAsText,
        },
        {
          key: 'copy-markdown',
          label: t('Copy as Markdown'),
          onAction: handleCopyAsMarkdown,
        },
      ]}
    />
  );
}
