import styled from '@emotion/styled';

import {pinFilter} from 'sentry/actionCreators/pageFilters';
import Button, {ButtonProps} from 'sentry/components/button';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {PinnedPageFilter} from 'sentry/types';

type Props = {
  filter: PinnedPageFilter;
  size: Extract<ButtonProps['size'], 'xsmall' | 'zero'>;
  className?: string;
};

function PageFilterPinButton({filter, size, className}: Props) {
  const {pinnedFilters} = useLegacyStore(PageFiltersStore);
  const pinned = pinnedFilters.has(filter);

  const onPin = () => {
    pinFilter(filter, !pinned);
  };

  return (
    <PinButton
      className={className}
      aria-pressed={pinned}
      aria-label={t('Lock filter')}
      onClick={onPin}
      size={size}
      pinned={pinned}
      borderless={size === 'zero'}
      icon={<IconLock isSolid={pinned} size="xs" />}
    />
  );
}

const PinButton = styled(Button)<{pinned: boolean; size: 'xsmall' | 'zero'}>`
  display: block;
  color: ${p => p.theme.subText};

  :hover {
    color: ${p => p.theme.textColor};
  }
  ${p => p.size === 'zero' && 'background: transparent'};
  ${p => p.pinned && `&& {color: ${p.theme.active}}`};
`;

export default PageFilterPinButton;
