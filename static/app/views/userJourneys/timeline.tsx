import styled from '@emotion/styled';
import moment from 'moment';

import CrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';

const NOTABLE_CATEGORIES = [
  'ui.click',
  'navigation',
  'sentry.event',
  'sentry.transaction',
];

type Props = {
  breadcrumbs: Array<Crumb>;
};

function Timeline({breadcrumbs}: Props) {
  // Assume crumbs are ordered by time.
  // const maxTime = moment(breadcrumbs[0].timestamp);
  // const minTime = moment(breadcrumbs[breadcrumbs.length -1].timestamp);
  // const spread = maxTime - minTime;
  const notable = extractHighlights(breadcrumbs);

  return (
    <ScrollContainer>
      <ItemRow>
        {notable.map((crumb, idx) => (
          <CrumbItem key={idx} crumb={crumb} />
        ))}
      </ItemRow>
    </ScrollContainer>
  );
}

type ItemProps = {
  crumb: Crumb;
};

function CrumbItem({crumb}: ItemProps) {
  return (
    <ItemContainer>
      <AxisLine />
      <IconWrapper color={crumb.color}>
        <CrumbIcon type={crumb.type} size="md" />
      </IconWrapper>
      <ItemTime>{moment(crumb.timestamp).format('HH:mm:ss')}</ItemTime>
    </ItemContainer>
  );
}

function extractHighlights(crumbs: Props['breadcrumbs']): Props['breadcrumbs'] {
  return crumbs.filter(crumb => {
    if (!crumb.category) {
      return false;
    }
    return NOTABLE_CATEGORIES.includes(crumb.category);
  });
}

const AxisLine = styled('div')`
  position: absolute;
  top: 28px;
  left: -${space(1)};
  right: -${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: 0;
`;

const ItemRow = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
`;

const ScrollContainer = styled('div')`
  position: relative;
  width: 100%;
  overflow-x: scroll;
  margin-bottom: ${space(3)};
`;

const ItemContainer = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(1)} 0;
`;

const IconWrapper = styled('div')<Pick<Crumb, 'color'>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  position: relative;
`;

const ItemTime = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Timeline;
