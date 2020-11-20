import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import InlineInput from 'app/components/inputInline';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {DashboardListItem} from './types';

type Props = {
  changesDashboard: DashboardListItem | undefined;
  setChangesDashboard: (dashboard: DashboardListItem) => void;
};

class DashboardTitle extends React.Component<Props> {
  refInput = React.createRef<InlineInput>();

  onBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDashboardTitle = (event.target.value || '').trim().slice(0, 255).trim();

    if (!nextDashboardTitle) {
      addErrorMessage(t('Please set the title for this dashboard'));

      // Help our users re-focus so they cannot run away from this problem
      if (this.refInput.current) {
        this.refInput.current.focus();
      }

      return;
    }

    const {changesDashboard, setChangesDashboard} = this.props;

    event.target.innerText = nextDashboardTitle;

    if (!changesDashboard) {
      return;
    }

    setChangesDashboard({
      ...changesDashboard,
      title: nextDashboardTitle,
    });
  };

  render() {
    const {changesDashboard} = this.props;

    if (!changesDashboard) {
      return <Container>{t('Dashboards')}</Container>;
    }

    return (
      <Container>
        <StyledInlineInput
          name="dashboard-title"
          ref={this.refInput}
          value={changesDashboard.title}
          onBlur={this.onBlur}
        />
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-right: ${space(1)};
`;

const StyledInlineInput = styled(
  React.forwardRef((props: InlineInput['props'], ref: React.Ref<InlineInput>) => (
    <InlineInput {...props} ref={ref} />
  ))
)`
  overflow-wrap: anywhere;
  white-space: normal;
`;

export default DashboardTitle;
