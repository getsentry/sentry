import styled from '@emotion/styled';
import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  event: Event;
  affectedSpanIds: string[];
};

export function SpanChangeBar() {
  return (
    <div>
      <ContextualDetail>
        {t('Exceeds 600ms threshold')}{' '}
        <HighlightedText>{t('(Bad Span Added)')}</HighlightedText>
      </ContextualDetail>

      <ChangeBar>
        <ChangeBarText>XX.X ms</ChangeBarText>
      </ChangeBar>

      <Footer>
        <IconClock />
        <SpanOperation>operation </SpanOperation> -{' '}
        <SpanDescription>description</SpanDescription>
      </Footer>
    </div>
  );
}

const Header = styled('div')`
  color: ${p => p.theme.gray300};
`;

const ContextualDetail = styled('div')``;

const HighlightedText = styled('span')`
  color: ${p => p.theme.purple300};
`;

const ChangeBar = styled('div')`
  background: ${p => p.theme.purple400};
  color: ${p => p.theme.white};
  font-size: 10px;
  width: 100%;
  height: ${space(3)};

  display: flex;
  align-items: center;
  justify-content: flex-end;
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
  font-weight: 6400;
`;
