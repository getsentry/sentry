import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Subtitle} from 'sentry/views/performance/landing/widgets/widgets/singleFieldAreaWidget';

type Props = {
  children: React.ReactNode;
  button?: React.JSX.Element;
  className?: string;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
};

export default function ChartPanel({
  title,
  children,
  button,
  subtitle,
  className,
}: Props) {
  return (
    <PanelWithNoPadding className={className}>
      <PanelBody>
        {title && (
          <Flex
            justify="between"
            align="center"
            width="100%"
            data-test-id="chart-panel-header"
          >
            {title && (
              <ChartLabel>
                {typeof title === 'string' ? (
                  <TextTitleContainer>{title}</TextTitleContainer>
                ) : (
                  title
                )}
              </ChartLabel>
            )}
            <Flex as="span">
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
            </Flex>
          </Flex>
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
  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.2;
`;

const PanelBody = styled('div')`
  padding: ${space(2)};
`;
