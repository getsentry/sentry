import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'sentry/components/panels';

type Props = {
  children: React.ReactNode;
  title?: string;
};

export default function ChartPanel({title, children}: Props) {
  return (
    <Panel>
      <PanelBody withPadding>
        {title && <ChartLabel>{title}</ChartLabel>}
        {children}
      </PanelBody>
    </Panel>
  );
}

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;
