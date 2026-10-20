import {IconOpen} from '@sentry/icons/open';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Menu} from '@sentry/scraps/menu';

import {t} from 'sentry/locale';
import {useStoppingPointSelectOptions} from 'sentry/utils/seer/stoppingPoint';
import type {SeerAutofixStoppingPoint} from 'sentry/utils/seer/types';

export function StoppingPointDropdownMenu({
  isDisabled,
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: SeerAutofixStoppingPoint) => void;
}) {
  const stoppingPointOptions = useStoppingPointSelectOptions();
  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size="xs"
      triggerLabel={t('Automation Steps')}
      items={stoppingPointOptions.map(option => ({
        key: option.value,
        label: option.label,
        onAction: () => onChange(option.value),
      }))}
      menuFooter={
        <Menu.Footer>
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works">
            <Flex gap="sm" align="center">
              <IconOpen size="xs" />
              {t('Read the Docs')}
            </Flex>
          </ExternalLink>
        </Menu.Footer>
      }
    />
  );
}
