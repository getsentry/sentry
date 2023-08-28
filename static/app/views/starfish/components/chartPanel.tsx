import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {space} from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  button?: JSX.Element;
  title?: React.ReactNode;
};

export default function ChartPanel({title, children, button}: Props) {
  return (
    <Panel>
      <PanelBody withPadding>
        {title && (
          <Header>
            {title && <ChartLabel>{title}</ChartLabel>}
            {button}
          </Header>
        )}
        {children}
      </PanelBody>
    </Panel>
  );
}

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;

const Header = styled('div')`
  padding: 0 ${space(1)} 0 0;
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
