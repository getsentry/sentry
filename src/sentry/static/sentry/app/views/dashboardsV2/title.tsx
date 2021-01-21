import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import InlineInput from 'app/components/inputInline';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
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
    const {dashboard, onUpdate} = this.props;
    if (!dashboard) {
      return;
    }

    event.target.innerText = nextDashboardTitle;

    onUpdate({
      ...dashboard,
      title: nextDashboardTitle,
    });
  };

  render() {
    const {dashboard, isEditing} = this.props;

    if (!dashboard) {
      return <Container>{t('Dashboards')}</Container>;
    }

    if (!isEditing) {
      return <Container>{dashboard.title}</Container>;
    }

    return (
      <Container>
        <StyledInlineInput
          name="dashboard-title"
          ref={this.refInput}
          value={dashboard.title}
          onBlur={this.onBlur}
        />
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-right: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    margin-right: 0;
    margin-bottom: ${space(2)};
  }
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
