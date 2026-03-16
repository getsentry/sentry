import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  examples: string[];
  sourceName: string;
};

export function SourceSuggestionExamples({examples, sourceName}: Props) {
  return (
    <Wrapper>
      <ExampleCard
        position="right"
        header={t('Examples for %s in current event', <code>{sourceName}</code>)}
        body={examples.map(example => (
          <pre key={example}>{example}</pre>
        ))}
      >
        <Content>
          {t('See Example')} <IconQuestion size="xs" />
        </Content>
      </ExampleCard>
    </Wrapper>
  );
}

const ExampleCard = styled(Hovercard)`
  width: 400px;

  pre:last-child {
    margin: 0;
  }
`;

const Content = styled('span')`
  display: inline-grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.colors.gray500};
  font-size: ${p => p.theme.font.size.sm};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

const Wrapper = styled('div')`
  grid-column: 3/3;
`;
