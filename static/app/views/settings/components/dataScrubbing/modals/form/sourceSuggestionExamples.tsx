import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  examples: Array<string>;
  sourceName: string;
};

const SourceSuggestionExamples = ({examples, sourceName}: Props) => (
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

export default SourceSuggestionExamples;

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
  gap: ${space(0.5)};
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

const Wrapper = styled('div')`
  grid-column: 3/3;
`;
