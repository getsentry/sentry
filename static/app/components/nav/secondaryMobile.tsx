import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  handleClickBack: () => void;
};

export function SecondaryMobile({handleClickBack}: Props) {
  const {setSecondaryNavEl, activeGroup} = useNavContext();

  return (
    <SecondaryMobileWrapper>
      <GroupHeader>
        <Button
          onClick={handleClickBack}
          icon={<IconChevron direction="left" />}
          aria-label={t('Back to primary navigation')}
          size="xs"
          borderless
        />
        <HeaderLabel>{activeGroup ? NAV_GROUP_LABELS[activeGroup] : ''}</HeaderLabel>
      </GroupHeader>
      <ContentWrapper ref={setSecondaryNavEl} />
    </SecondaryMobileWrapper>
  );
}

const SecondaryMobileWrapper = styled('div')`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  height: 100%;
  overflow-y: auto;

  display: grid;
  grid-template-areas:
    'header'
    'content';
  grid-template-rows: auto 1fr;
`;

const GroupHeader = styled('h2')`
  grid-area: header;
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${p => p.theme.background};
  display: flex;
  align-items: center;
  padding: ${space(2)} ${space(1)};
  gap: ${space(1)};
  margin: 0;
`;

const ContentWrapper = styled('div')`
  grid-area: content;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-direction: column;
`;

const HeaderLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;
