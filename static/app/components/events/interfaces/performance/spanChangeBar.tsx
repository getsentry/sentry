import styled from '@emotion/styled';
import Tooltip from 'sentry/components/tooltip';
import {IconClock, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types';

type Props = {
  detailText: string;
  tooltipText: string;
  duration: number;
  durationPercentage: number;
  op: string;
  description: string;
  Icon: React.FC;
};

function SpanChangeBar({
  detailText,
  tooltipText,
  duration,
  durationPercentage,
  op,
  description,
  Icon,
}: Props) {
  return (
    <div>
      <Heading>
        {t('Span Change')}
        <TooltipWrapper>
          <Tooltip title={tooltipText}>
            <IconQuestion />
          </Tooltip>
        </TooltipWrapper>
      </Heading>
      <ContextualDetail>
        {`${detailText} `}
        <HighlightedText>{t('(Bad Span Added)')}</HighlightedText>
      </ContextualDetail>

      <ChangeBarBackdrop>
        <ChangeBar durationPercentage={durationPercentage}>
          <ChangeBarText>{`${duration} ms`}</ChangeBarText>
        </ChangeBar>
      </ChangeBarBackdrop>

      <Footer>
        <Icon />
        <SpanOperation>{`${op} `}</SpanOperation> -{' '}
        <SpanDescription>{`${description}`}</SpanDescription>
      </Footer>
    </div>
  );
}

type BaseProps = {
  event: Event;
  affectedSpanIds: string[];
};

export function SlowDbSpanChangeBar(props: BaseProps) {
  return (
    <SpanChangeBar
      detailText={'Exceeds 600ms threshold'}
      tooltipText={'Test'}
      duration={600}
      durationPercentage={75}
      op={'db'}
      description={'SELECT "auth_user"'}
      Icon={() => <IconClock />}
    />
  );
}

const Heading = styled('h3')`
  display: flex;
  align-items: center;
`;

const TooltipWrapper = styled('span')`
  margin-left: ${space(1)};
`;

const ContextualDetail = styled('div')`
  margin-bottom: ${space(1)};
`;

const HighlightedText = styled('span')`
  color: ${p => p.theme.purple300};
`;

const ChangeBar = styled('div')<{durationPercentage: number}>`
  background: ${p => p.theme.purple400};
  color: ${p => p.theme.white};
  font-size: 10px;
  width: ${p => p.durationPercentage}%;
  height: ${space(3)};
  margin-bottom: ${space(1)};

  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const ChangeBarBackdrop = styled('div')`
  background: ${p => p.theme.gray100};
`;

const ChangeBarText = styled('div')`
  margin-right: ${space(1)};
`;

const Footer = styled('div')`
  color: ${p => p.theme.gray500};

  display: flex;
  align-items: center;
`;

const SpanOperation = styled('span')`
  font-weight: 600;
  margin-left: ${space(1)};
`;

const SpanDescription = styled('span')`
  font-weight: 400;
`;
