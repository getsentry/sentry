import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
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
    <PanelWithNoPadding>
      <PanelBody>
        {title && (
          <Header data-test-id="chart-panel-header">
            {title && (
              <ChartLabel>
                {typeof title === 'string' ? (
                  <TextTitleContainer>{title}</TextTitleContainer>
                ) : (
                  title
                )}
              </ChartLabel>
            )}
            {button}
            <Button
              aria-label={t('Expand Insight Chart')}
              borderless
              size="xs"
              icon={<IconExpand />}
              onClick={() => {
                openInsightChartModal({title, children});
              }}
            />
          </Header>
        )}
        {subtitle && (
          <SubtitleContainer>
            <Subtitle>{subtitle}</Subtitle>
          </SubtitleContainer>
        )}
        {children}
      </PanelBody>
    </PanelWithNoPadding>
  );
}

const PanelWithNoPadding = styled(Panel)`
  margin-bottom: 0;
`;

const TextTitleContainer = styled('div')`
  padding: 1px 0;
`;

const SubtitleContainer = styled('div')`
  padding-top: ${space(0.5)};
`;

const ChartLabel = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const PanelBody = styled('div')`
  padding: ${space(2)};
`;

const Header = styled('div')`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
