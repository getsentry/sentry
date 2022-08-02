import {Fragment} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import HTMLCode from 'sentry/components/htmlCode';
import {PanelTable} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import Truncate from 'sentry/components/truncate';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

type Props = {
  replay: ReplayReader;
};

function DomMutations({replay}: Props) {
  const {isLoading, actions} = useExtractedCrumbHtml({replay});

  const startTimestampMs = replay.getReplay().started_at.getTime();

  return (
    <Fragment>
      <StyledPanelTable
        isEmpty={actions.length === 0}
        emptyMessage={t('No DOM actions found.')}
        isLoading={isLoading}
        headers={[t('Action'), t('Selector'), t('HTML'), t('Timestamp')]}
      >
        {actions.map((mutation, i) => (
          <Fragment key={i}>
            <TitleContainer>
              <IconWrapper color={mutation.crumb.color}>
                <BreadcrumbIcon type={mutation.crumb.type} />
              </IconWrapper>
              <Title>{getDetails(mutation.crumb).title}</Title>
            </TitleContainer>

            <Column>
              <Truncate
                maxLength={30}
                leftTrim={(mutation.crumb.message || '').includes('>')}
                value={mutation.crumb.message || ''}
              />
            </Column>

            <Column>
              <CodeContainer>
                <HTMLCode code={mutation.html} />
              </CodeContainer>
            </Column>

            <Column>
              <PlayerRelativeTime
                relativeTimeMs={startTimestampMs}
                timestamp={mutation.crumb.timestamp}
              />
              {}
            </Column>
          </Fragment>
        ))}
      </StyledPanelTable>
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content max-content 1fr max-content;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Column = styled('div')`
  display: flex;
  align-items: flex-start;
  overflow: hidden;
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  color: ${p => p.theme.gray400};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const CodeContainer = styled('div')`
  overflow: auto;
  max-height: 400px;
`;

export default DomMutations;
