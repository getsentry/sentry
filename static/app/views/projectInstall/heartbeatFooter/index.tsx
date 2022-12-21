import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import IdBadge from 'sentry/components/idBadge';
import type {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';

type Props = {
  actions: React.ReactNode;
  project: {
    platform: string;
    slug: string;
  };
};

export function HeartbeatFooter({project, actions}: Props) {
  return (
    <Wrapper>
      <IdBadge
        project={{platform: project.platform as PlatformKey, slug: project.slug}}
        avatarSize={28}
        hideOverflow="100%"
        disableLink
      />
      <Beats>
        <Beat>
          <PulsingIndicator>1</PulsingIndicator>
          {t('Awaiting server connection')}
        </Beat>
        <Beat>
          <PulsingIndicator>2</PulsingIndicator>
          {t('Awaiting for first error')}
        </Beat>
      </Beats>
      <StyledButtonBar gap={1}>{actions}</StyledButtonBar>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: sticky;
  bottom: 0;
  width: 100%;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  background: ${p => p.theme.background};
  padding: ${space(2)} 0;
  margin-bottom: -${space(3)};
  align-items: center;
  z-index: 1;
  gap: ${space(1)};
`;

const StyledButtonBar = styled(ButtonBar)`
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const Beats = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: center;
`;

const Beat = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.pink300};
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.white};
  height: 18px;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
