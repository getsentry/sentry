import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {DateTime} from 'sentry/components/dateTime';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

type RelaxedDateType = React.ComponentProps<typeof TimeSince>['date'];

type Props = {
  date: RelaxedDateType;
  dateGlobal: RelaxedDateType;
  environment?: string;
};

export function SeenInfo({date, dateGlobal, environment}: Props) {
  return (
    <Flex align="baseline">
      <StyledHovercard
        showUnderline
        header={
          <div>
            <Flex justify="between" marginBottom="xs">
              {t('Any Environment')}
              <TimeSince date={dateGlobal} disabledAbsoluteTooltip />
            </Flex>
            {environment && (
              <Flex justify="between" marginBottom="xs">
                {toTitleCase(environment)}
                {date ? (
                  <TimeSince date={date} disabledAbsoluteTooltip />
                ) : (
                  <span>{t('N/A')}</span>
                )}
              </Flex>
            )}
          </div>
        }
        body={
          date ? (
            <StyledDateTime date={date} />
          ) : (
            <NoEnvironment>{t('N/A for %s', environment)}</NoEnvironment>
          )
        }
        position="top"
      >
        <DateWrapper>
          {date ? (
            <TooltipWrapper>
              <StyledTimeSince date={date} disabledAbsoluteTooltip />
            </TooltipWrapper>
          ) : dateGlobal && environment === '' ? (
            <Fragment>
              <TimeSince date={dateGlobal} disabledAbsoluteTooltip />
              <StyledTimeSince date={dateGlobal} disabledAbsoluteTooltip />
            </Fragment>
          ) : (
            <NoDateTime>{t('N/A')}</NoDateTime>
          )}
        </DateWrapper>
      </StyledHovercard>
    </Flex>
  );
}

const dateTimeCss = (p: any) => css`
  color: ${p.theme.tokens.content.secondary};
  font-size: ${p.theme.font.size.md};
  display: flex;
  justify-content: center;
`;

const DateWrapper = styled('div')`
  margin-bottom: 0;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledDateTime = styled(DateTime)`
  ${dateTimeCss};
`;

const NoEnvironment = styled('div')`
  ${dateTimeCss};
`;

const NoDateTime = styled('span')`
  margin-right: ${p => p.theme.space.xs};
`;

const TooltipWrapper = styled('span')`
  margin-right: ${p => p.theme.space['2xs']};
  svg {
    margin-right: ${p => p.theme.space.xs};
    position: relative;
    top: 1px;
  }
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.2;
`;

const StyledHovercard = styled(Hovercard)`
  width: 250px;
  ${Header} {
    font-weight: ${p => p.theme.font.weight.sans.regular};
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
  ${Body} {
    padding: ${p => p.theme.space.lg};
  }
`;
