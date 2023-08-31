import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {space} from 'sentry/styles/space';
import {Subtitle} from 'sentry/views/performance/landing/widgets/widgets/singleFieldAreaWidget';

type Props = {
  children: React.ReactNode;
  button?: JSX.Element;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
};

export default function ChartPanel({title, children, button, subtitle}: Props) {
  return (
    <Panel>
      <PanelBody withPadding>
        {title && (
          <Header>
            {title && <ChartLabel>{title}</ChartLabel>}
            {button}
          </Header>
        )}
        {subtitle && (
          <SubtitleContainer>
            <Subtitle>{subtitle}</Subtitle>
          </SubtitleContainer>
        )}
        {children}
      </PanelBody>
    </Panel>
  );
}

const SubtitleContainer = styled('div')`
  padding-top: ${space(0.5)};
`;

const ChartLabel = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const Header = styled('div')`
  padding: 0 ${space(1)} 0 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
