import {IconChevron} from '@sentry/icons/chevron';
import {IconCopy} from '@sentry/icons/copy';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {t, tn} from 'sentry/locale';
import type {BaseGroup} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';

type CopyType = 'short_ids' | 'links';

const LAST_COPY_TYPE_KEY = 'issue-list-bulk-copy-type';

const COPY_TYPES: CopyType[] = ['short_ids', 'links'];

const COPY_OPTIONS: Record<CopyType, {buttonLabel: string; menuLabel: string}> = {
  short_ids: {buttonLabel: t('Copy Short-IDs'), menuLabel: t('Copy Issue Short-IDs')},
  links: {buttonLabel: t('Copy Links'), menuLabel: t('Copy Issue Links')},
};

interface CopyActionsProps {
  allInQuerySelected: boolean;
  anySelected: boolean;
  selectedIssues: BaseGroup[];
}

export function CopyActions({
  allInQuerySelected,
  anySelected,
  selectedIssues,
}: CopyActionsProps) {
  const organization = useOrganization();
  const area = useAnalyticsArea();
  const [lastCopyType, setLastCopyType] = useLocalStorageState<CopyType>(
    LAST_COPY_TYPE_KEY,
    storedValue => (storedValue === 'links' ? 'links' : 'short_ids')
  );

  const disabled = !anySelected || allInQuerySelected;
  // Only issues loaded on the current page are available to copy
  const disabledReason = allInQuerySelected
    ? t('Only available for issues selected on this page')
    : undefined;

  const handleCopy = (copyType: CopyType) => {
    setLastCopyType(copyType);
    const text = selectedIssues
      .map(issue => (copyType === 'short_ids' ? issue.shortId : issue.permalink))
      .join('\n');
    copyToClipboard(text, {
      successMessage:
        copyType === 'short_ids'
          ? tn(
              'Copied %s issue Short-ID to clipboard',
              'Copied %s issue Short-IDs to clipboard',
              selectedIssues.length
            )
          : tn(
              'Copied %s issue link to clipboard',
              'Copied %s issue links to clipboard',
              selectedIssues.length
            ),
    });
    trackAnalytics('issues_stream.copied', {
      organization,
      area,
      copy_type: copyType,
      count: selectedIssues.length,
    });
  };

  const menuItems: MenuItemProps[] = COPY_TYPES.map(copyType => ({
    key: copyType,
    label: COPY_OPTIONS[copyType].menuLabel,
    onAction: () => handleCopy(copyType),
  }));

  return (
    <ButtonBar>
      <Button
        size="xs"
        icon={<IconCopy />}
        disabled={disabled}
        tooltipProps={{title: disabledReason}}
        onClick={() => handleCopy(lastCopyType)}
      >
        {COPY_OPTIONS[lastCopyType].buttonLabel}
      </Button>
      <DropdownMenu
        size="sm"
        position="bottom-end"
        isDisabled={disabled}
        trigger={(triggerProps, isOpen) => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            aria-label={t('Copy options')}
            size="xs"
            icon={
              <IconChevron variant="muted" direction={isOpen ? 'up' : 'down'} size="xs" />
            }
            disabled={disabled}
          />
        )}
        items={menuItems}
      />
    </ButtonBar>
  );
}
