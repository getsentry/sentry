import styled from '@emotion/styled';

import {IconLock} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {PinnedPageFilter} from 'sentry/types';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  children: React.ReactNode;
  filter: PinnedPageFilter;
};

function PageFilterPinIndicator({children, filter}: Props) {
  const {pinnedFilters} = usePageFilters();
  const pinned = pinnedFilters.has(filter);

  return (
    <Wrap>
      {children}
      {pinned && (
        <IndicatorWrap aria-label="Filter applied across pages">
          <StyledIconLock size="xs" isSolid />
        </IndicatorWrap>
      )}
    </Wrap>
  );
}

export default PageFilterPinIndicator;

const Wrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  transform: translateX(-${space(0.25)});
`;

const IndicatorWrap = styled('div')`
  position: absolute;
  bottom: 0;
  right: 0;
  transform: translate(50%, 35%);
  border-radius: 50%;
  background-color: ${p => p.theme.background};

  padding: ${space(0.25)};

  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIconLock = styled(IconLock)`
  width: 0.5rem;
  height: 0.5rem;
  color: ${p => p.theme.textColor};
`;
