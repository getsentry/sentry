import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import {
  GenericPerformanceWidgetProps,
  WidgetDataConstraint,
  WidgetDataProps,
} from '../types';

export function WidgetFooter<T extends WidgetDataConstraint>(
  props: GenericPerformanceWidgetProps<T> & WidgetDataProps<T>
) {
  const {Footer} = props;
  if (!Footer) {
    return null;
  }

  return (
    <WidgetFooterContainer>
      <Footer {...props} />
    </WidgetFooterContainer>
  );
}

const WidgetFooterContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
`;
