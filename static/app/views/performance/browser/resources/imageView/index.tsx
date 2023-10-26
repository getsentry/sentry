import {Fragment, MouseEventHandler} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import ResourceTable from 'sentry/views/performance/browser/resources/imageView/resourceTable';
import {useImageResourceSort} from 'sentry/views/performance/browser/resources/imageView/utils/useImageResourceSort';
import {FilterOptionsContainer} from 'sentry/views/performance/browser/resources/jsCssView';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const {RESOURCE_RENDER_BLOCKING_STATUS} = SpanIndexedField;

function ImageView() {
  const sort = useImageResourceSort();
  const location = useLocation();
  const filters = useResourceModuleFilters();

  const handleBlockingToggle: MouseEventHandler = () => {
    const hasBlocking = filters[RESOURCE_RENDER_BLOCKING_STATUS] === 'blocking';
    const newBlocking = hasBlocking ? undefined : 'blocking';
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        [RESOURCE_RENDER_BLOCKING_STATUS]: newBlocking,
      },
    });
  };

  return (
    <Fragment>
      <FilterOptionsContainer>
        <SwitchContainer>
          <SwitchButton
            toggle={handleBlockingToggle}
            isActive={filters[RESOURCE_RENDER_BLOCKING_STATUS] === 'blocking'}
          />
          {t('Render Blocking')}
        </SwitchContainer>
      </FilterOptionsContainer>
      <ResourceTable sort={sort} />
    </Fragment>
  );
}

const SwitchContainer = styled('div')`
  display: flex;
  align-items: center;
  column-gap: ${space(1)};
`;

export default ImageView;
