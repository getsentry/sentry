import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import ErrorBoundary from 'app/components/errorBoundary';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {Widget} from './types';

type Props = {
  widget: Widget;
  selection: GlobalSelection;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (
      !isEqual(nextProps.widget.queries, this.props.widget.queries) ||
      !isEqual(nextProps.selection, this.props.selection) ||
      nextProps.widget.title !== this.props.widget.title
    ) {
      return true;
    }
    return false;
  }

  render() {
    const {widget} = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel>
          <WidgetHeader>{widget.title}</WidgetHeader>
          <StyledPanelBody>{JSON.stringify(widget.queries)}</StyledPanelBody>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withGlobalSelection(WidgetCard);

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const WidgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 250px;
`;
