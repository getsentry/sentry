import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Button as CommonButton, LinkButton} from 'sentry/components/button';
import {
  SpanDetailContainer,
  SpanDetails,
} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {DataSection} from 'sentry/components/events/styles';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const DetailContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};

  ${DataSection} {
    padding: 0;
  }

  ${SpanDetails} {
    padding: 0;
  }

  ${SpanDetailContainer} {
    border-bottom: none !important;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const Actions = styled(FlexBox)`
  gap: ${space(0.5)};
`;

const Title = styled(FlexBox)`
  gap: ${space(1)};
  min-width: 150px;
`;

const Type = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TitleOp = styled('div')`
  font-size: 15px;
  font-weight: bold;
  max-width: 600px;
  ${p => p.theme.overflowEllipsis}
`;

const Table = styled('table')`
  margin-bottom: 0 !important;
`;

const IconTitleWrapper = styled(FlexBox)`
  gap: ${space(1)};
`;

const IconBorder = styled('div')<{errored?: boolean}>`
  background-color: ${p => (p.errored ? p.theme.error : p.theme.blue300)};
  border-radius: ${p => p.theme.borderRadius};
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;

  svg {
    fill: ${p => p.theme.white};
    width: 14px;
    height: 14px;
  }
`;

const Button = styled(CommonButton)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const HeaderContainer = styled(Title)`
  justify-content: space-between;
`;

function EventDetailsLink(props: {eventId: string; projectSlug?: string}) {
  const query = useMemo(() => {
    return {...qs.parse(location.search), legacy: 1};
  }, []);
  return (
    <LinkButton
      disabled={!props.eventId || !props.projectSlug}
      title={
        !props.eventId || !props.projectSlug
          ? t('Event ID or Project Slug missing')
          : undefined
      }
      size="xs"
      to={{
        pathname: `/performance/${props.projectSlug}:${props.eventId}/`,
        query: query,
      }}
    >
      {t('View Event Details')}
    </LinkButton>
  );
}

const TraceDrawerComponents = {
  DetailContainer,
  FlexBox,
  Title,
  Type,
  TitleOp,
  HeaderContainer,
  Actions,
  Table,
  IconTitleWrapper,
  IconBorder,
  EventDetailsLink,
  Button,
};

export {TraceDrawerComponents};
