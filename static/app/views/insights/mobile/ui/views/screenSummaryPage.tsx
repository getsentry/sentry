import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ReleaseSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {SamplesTables} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';
import {SpanOperationTable} from 'sentry/views/insights/mobile/ui/components/tables/spanOperationTable';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  'device.class': string;
  primaryRelease: string;
  project: string;
  spanDescription: string;
  spanGroup: string;
  spanOp: string;
  transaction: string;
};

export function ScreenSummaryContent() {
  const router = useRouter();
  const location = useLocation<Query>();

  const {transaction: transactionName, spanGroup} = location.query;

  useSamplesDrawer({
    Component: <SpanSamplesPanel groupId={spanGroup} moduleName={ModuleName.OTHER} />,
    moduleName: ModuleName.OTHER,
    requiredParams: ['spanGroup', 'spanOp'],
    onClose: () => {
      router.replace({
        pathname: router.location.pathname,
        query: omit(
          router.location.query,
          'spanGroup',
          'transactionMethod',
          'spanDescription',
          'spanOp'
        ),
      });
    },
  });

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <ModulePageFilterBar
            moduleName={ModuleName.SCREEN_RENDERING}
            disableProjectFilter
          />
          <ReleaseSelector moduleName={ModuleName.SCREEN_RENDERING} />
        </ToolRibbon>
      </HeaderContainer>

      <SamplesContainer>
        <SamplesTables
          transactionName={transactionName}
          SpanOperationTable={SpanOperationTable}
          // for now, let's only show the span ops table
          EventSamples={undefined}
        />
      </SamplesContainer>
    </Fragment>
  );
}

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
