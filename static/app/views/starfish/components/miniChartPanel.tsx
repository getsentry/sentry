import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';

type Props = {
  children: React.ReactNode;
  button?: JSX.Element;
  title?: string;
};

export default function MiniChartPanel({title, children, button}: Props) {
  return (
    <Panel>
      <PanelBody>
        <Header>
          {title && <ChartLabel>{title}</ChartLabel>}
          {button}
        </Header>
        {children}
      </PanelBody>
    </Panel>
  );
}

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;

const Header = styled('div')`
  padding: 0 ${space(1)} ${space(1)} 0;
  min-height: 24px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PanelBody = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  ${textStyles};
`;
