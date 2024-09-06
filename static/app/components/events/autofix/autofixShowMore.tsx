import {type ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AutofixShowMore = {
  children: ReactNode;
  title: ReactNode;
};

export function AutofixShowMore({children, title}: AutofixShowMore) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Wrapper>
      <Header onClick={() => setIsExpanded(value => !value)}>
        <InteractionStateLayer />
        <Title>{title}</Title>
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Toggle details')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
        />
      </Header>
      {isExpanded ? <Content>{children}</Content> : null}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: ${space(1.5)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Header = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  padding: ${space(1)} ${space(2)};
  cursor: pointer;
  user-select: none;
`;

const Content = styled('div')`
  margin-top: ${space(1)};
`;
