import React from 'react';
import styled from '@emotion/styled';

import EditableText from 'app/components/editableText';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditing, onUpdate}: Props) {
  return (
    <Container>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <StyledEditableText
          isDisabled={!isEditing}
          value={dashboard.title}
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          successMessage={t('Dashboard title updated successfully')}
        />
      )}
    </Container>
  );
}

export default DashboardTitle;

const Container = styled('div')`
  ${overflowEllipsis};
  margin-right: ${space(1)};
  margin-left: -12px;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    margin-bottom: ${space(2)};
  }
`;

const StyledEditableText = styled(EditableText)`
  position: absolute;
  width: calc(100% + 12px);
`;
