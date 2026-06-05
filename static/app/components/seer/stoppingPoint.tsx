import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import {PROJECT_STOPPING_POINT_OPTIONS} from 'sentry/utils/seer/stoppingPoint';
import type {UserFacingStoppingPoint} from 'sentry/utils/seer/types';

/**
 * Render a user-facing stopping point to its human-readable label.
 */
export function StoppingPointLabel({
  stoppingPoint,
}: {
  stoppingPoint: UserFacingStoppingPoint;
}) {
  return (
    <Fragment>
      {PROJECT_STOPPING_POINT_OPTIONS.find(o => o.value === stoppingPoint)?.label ??
        stoppingPoint}
    </Fragment>
  );
}

export function StoppingPointDropdownMenu({
  isDisabled,
  size = 'xs',
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: UserFacingStoppingPoint) => void;
  size?: DropdownMenuProps['size'];
}) {
  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size={size}
      triggerLabel={t('Automation Steps')}
      items={PROJECT_STOPPING_POINT_OPTIONS.map(option => ({
        key: option.value,
        label: option.label,
        onAction: () => onChange(option.value),
      }))}
      menuFooter={
        <DropdownMenuFooter>
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works">
            <Flex gap="sm" align="center">
              <IconOpen size="xs" />
              {t('Read the Docs')}
            </Flex>
          </ExternalLink>
        </DropdownMenuFooter>
      }
    />
  );
}
