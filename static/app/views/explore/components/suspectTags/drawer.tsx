import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ChartInfo} from 'sentry/views/explore/charts';
import {Charts} from 'sentry/views/explore/components/suspectTags/charts';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';
import useSuspectAttributes from 'sentry/views/explore/hooks/useSuspectAttributes';

type Props = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
};

export function Drawer({boxSelectOptions, chartInfo}: Props) {
  const {data, isLoading, isError} = useSuspectAttributes({boxSelectOptions, chartInfo});

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <Title>{t('Suspect Attributes')}</Title>
        <SubTitle>
          {t(
            'Comparing selected and unselected (baseline) data, we sorted  attributes that differ the most in frequency. This indicates how suspicious they are. '
          )}
        </SubTitle>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError message={t('Failed to load suspect attributes')} />
        ) : (
          <Charts rankedAttributes={data!.rankedAttributes} />
        )}
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

const Title = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const SubTitle = styled('span')``;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;

  > header {
    flex-shrink: 0;
  }
`;
