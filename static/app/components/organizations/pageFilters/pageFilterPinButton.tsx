import styled from '@emotion/styled';

import {pinFilter} from 'sentry/actionCreators/pageFilters';
import Button, {ButtonProps} from 'sentry/components/button';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization, PinnedPageFilter} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

type Props = {
  filter: PinnedPageFilter;
  organization: Organization;
  size: Extract<ButtonProps['size'], 'xsmall' | 'zero'>;
  className?: string;
};

function PageFilterPinButton({filter, organization, size, className}: Props) {
  const {pinnedFilters} = useLegacyStore(PageFiltersStore);
  const pinned = pinnedFilters.has(filter);

  const onPin = () => {
    trackAdvancedAnalyticsEvent('page_filters.pin_click', {
      organization,
      filter,
      pin: !pinned,
    });
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
      title={t('Apply filter across pages')}
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
