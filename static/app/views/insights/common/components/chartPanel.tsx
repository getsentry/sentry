import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Panel} from 'sentry/components/panels/panel';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
};

export function ChartPanel({title, children, className}: Props) {
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
              <Button
                aria-label={t('Expand Insight Chart')}
                variant="transparent"
                size="xs"
                icon={<IconExpand />}
                onClick={() => {
                  openInsightChartModal({title, children});
                }}
              />
            </Flex>
          </Flex>
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

const ChartLabel = styled('div')`
  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.2;
`;

const PanelBody = styled('div')`
  padding: ${p => p.theme.space.xl};
`;
